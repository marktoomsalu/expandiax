import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativePlatform } from "./capacitor";

export function tapLight() {
  if (!isNativePlatform()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function tapSuccess() {
  if (!isNativePlatform()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
