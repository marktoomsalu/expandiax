package com.expandiax.app;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.SystemClock;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * World Connect on Android: the same job as ios/App/App/GlobeTouchPlugin.swift,
 * with Android's own radios, so the website (src/lib/globeTouch.ts) runs
 * unchanged on both.
 *
 *  - Google Nearby Connections finds nearby phones running ExpandiaX and
 *    opens an encrypted link to each (UKEY2 key exchange, as Multipeer's
 *    required encryption on iPhone). Peers are named by a random id made for
 *    each start, never by anything about the person. Android ↔ Android only:
 *    Apple's Multipeer and Google's Nearby can't talk to each other.
 *  - The accelerometer reports a sharp knock ("bump"). Android phones have no
 *    equivalent of Apple's Nearby Interaction distance, so two phones connect
 *    when both feel the knock at once (as iPhones without the distance chip).
 *
 * Events: peerConnected, peerLost, message, bump, unavailable.
 */
@CapacitorPlugin(
    name = "GlobeTouch",
    permissions = {
        // Android 13 and newer.
        @Permission(alias = "nearby33", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.NEARBY_WIFI_DEVICES
        }),
        // Android 12.
        @Permission(alias = "nearby31", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.ACCESS_FINE_LOCATION
        }),
        // Android 11 and older: Bluetooth scanning needs location.
        @Permission(alias = "nearbyOld", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class GlobeTouchPlugin extends Plugin implements SensorEventListener {
    private static final String SERVICE_ID = "com.expandiax.touch";
    // What a payload is: the website's own message (the same framing as iPhone).
    private static final byte KIND_MESSAGE = 0;

    private ConnectionsClient client;
    private String me;
    private boolean running = false;
    // endpointId → the peer's random id (what the website calls peerId), once linked.
    private final Map<String, String> linked = new HashMap<>();
    // endpointId → random id, for links being set up.
    private final Map<String, String> pending = new HashMap<>();

    private SensorManager sensors;
    private double bumpThreshold = 1.6; // g, beyond gravity
    private long lastBump = 0;

    private String alias() {
        if (Build.VERSION.SDK_INT >= 33) return "nearby33";
        if (Build.VERSION.SDK_INT >= 31) return "nearby31";
        return "nearbyOld";
    }

    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject out = new JSObject();
        out.put("available", true);
        out.put("preciseDistance", false);
        out.put("motion", linearAccelerometer() != null);
        call.resolve(out);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(alias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias(), call, "afterPermission");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) {
            begin(call);
        } else {
            // Without the radios: say so, and still feel knocks (nothing to pair them with, though).
            JSObject e = new JSObject();
            e.put("reason", "network");
            e.put("message", "Nearby devices permission was not allowed.");
            notifyListeners("unavailable", e);
            call.reject("Nearby devices permission was not allowed.");
        }
    }

    private void begin(PluginCall call) {
        Double threshold = call.getDouble("bumpThreshold");
        if (threshold != null) bumpThreshold = threshold;
        boolean useMotion = call.getBoolean("motion", true);

        stopAll();
        me = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        client = Nearby.getConnectionsClient(getContext());
        running = true;

        AdvertisingOptions advertising = new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build();
        DiscoveryOptions discovery = new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build();
        client.startAdvertising(me, SERVICE_ID, lifecycle, advertising).addOnFailureListener(e -> unavailable(e.getMessage()));
        client.startDiscovery(SERVICE_ID, discoveryCallback, discovery).addOnFailureListener(e -> unavailable(e.getMessage()));
        if (useMotion) startMotion();

        JSObject out = new JSObject();
        out.put("id", me);
        out.put("preciseDistance", false);
        call.resolve(out);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAll();
        call.resolve();
    }

    /** Sends the website's message (a string) to one peer, or to every linked peer. */
    @PluginMethod
    public void send(PluginCall call) {
        String text = call.getString("data");
        if (text == null) {
            call.reject("Nothing to send.");
            return;
        }
        if (client == null) {
            call.reject("Not started.");
            return;
        }
        String target = call.getString("peerId");
        List<String> endpoints = new ArrayList<>();
        for (Map.Entry<String, String> e : linked.entrySet()) {
            if (target == null || target.equals(e.getValue())) endpoints.add(e.getKey());
        }
        if (endpoints.isEmpty()) {
            call.reject("That phone isn't linked.");
            return;
        }
        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        byte[] packet = new byte[body.length + 1];
        packet[0] = KIND_MESSAGE;
        System.arraycopy(body, 0, packet, 1, body.length);
        client.sendPayload(endpoints, Payload.fromBytes(packet))
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> call.reject("Could not send: " + e.getMessage()));
    }

    @Override
    protected void handleOnDestroy() {
        stopAll();
        super.handleOnDestroy();
    }

    // ---- Internals ----------------------------------------------------------

    private void stopAll() {
        stopMotion();
        if (client != null) {
            client.stopAdvertising();
            client.stopDiscovery();
            client.stopAllEndpoints();
        }
        linked.clear();
        pending.clear();
        running = false;
        client = null;
        me = null;
    }

    private void unavailable(String message) {
        JSObject e = new JSObject();
        e.put("reason", "network");
        e.put("message", message == null ? "Nearby isn't available." : message);
        notifyListeners("unavailable", e);
    }

    private final EndpointDiscoveryCallback discoveryCallback = new EndpointDiscoveryCallback() {
        @Override
        public void onEndpointFound(@NonNull String endpointId, @NonNull DiscoveredEndpointInfo info) {
            if (!running || client == null || me == null || !SERVICE_ID.equals(info.getServiceId())) return;
            String name = info.getEndpointName();
            // Only one side asks, or the two requests cross (as on iPhone).
            if (me.compareTo(name) >= 0 || linked.containsKey(endpointId) || pending.containsKey(endpointId)) return;
            pending.put(endpointId, name);
            client.requestConnection(me, endpointId, lifecycle).addOnFailureListener(e -> pending.remove(endpointId));
        }

        @Override
        public void onEndpointLost(@NonNull String endpointId) {}
    };

    private final ConnectionLifecycleCallback lifecycle = new ConnectionLifecycleCallback() {
        @Override
        public void onConnectionInitiated(@NonNull String endpointId, @NonNull ConnectionInfo info) {
            if (!running || client == null) return;
            // Encrypted either way; like iPhone's World Connect, any phone running it may link
            // (what they say still has to match up on the server before anything happens).
            pending.put(endpointId, info.getEndpointName());
            client.acceptConnection(endpointId, payloads);
        }

        @Override
        public void onConnectionResult(@NonNull String endpointId, @NonNull ConnectionResolution result) {
            String name = pending.remove(endpointId);
            if (name == null || result.getStatus().getStatusCode() != ConnectionsStatusCodes.STATUS_OK) return;
            linked.put(endpointId, name);
            JSObject e = new JSObject();
            e.put("peerId", name);
            notifyListeners("peerConnected", e);
        }

        @Override
        public void onDisconnected(@NonNull String endpointId) {
            String name = linked.remove(endpointId);
            if (name == null) return;
            JSObject e = new JSObject();
            e.put("peerId", name);
            notifyListeners("peerLost", e);
        }
    };

    private final PayloadCallback payloads = new PayloadCallback() {
        @Override
        public void onPayloadReceived(@NonNull String endpointId, @NonNull Payload payload) {
            String name = linked.get(endpointId);
            byte[] bytes = payload.asBytes();
            if (name == null || bytes == null || bytes.length < 1 || bytes[0] != KIND_MESSAGE) return;
            JSObject e = new JSObject();
            e.put("peerId", name);
            e.put("data", new String(Arrays.copyOfRange(bytes, 1, bytes.length), StandardCharsets.UTF_8));
            notifyListeners("message", e);
        }

        @Override
        public void onPayloadTransferUpdate(@NonNull String endpointId, @NonNull PayloadTransferUpdate update) {}
    };

    // ---- Knocks ---------------------------------------------------------------

    private Sensor linearAccelerometer() {
        if (sensors == null) sensors = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        return sensors == null ? null : sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
    }

    private void startMotion() {
        Sensor s = linearAccelerometer();
        if (s != null) sensors.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME);
    }

    private void stopMotion() {
        if (sensors != null) sensors.unregisterListener(this);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        // m/s² without gravity → g, the same measure as iPhone's userAcceleration.
        double x = event.values[0], y = event.values[1], z = event.values[2];
        double g = Math.sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH;
        long now = SystemClock.elapsedRealtime();
        if (g >= bumpThreshold && now - lastBump > 500) {
            lastBump = now;
            JSObject e = new JSObject();
            e.put("strength", g);
            e.put("at", (double) System.currentTimeMillis());
            notifyListeners("bump", e);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
