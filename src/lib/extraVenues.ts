// Concert places the venue lists (built from Wikidata: stadiums, arenas,
// halls, theatres) miss, mostly open-air grounds where the biggest tours
// play: Tallinn's Song Festival Grounds, Riga's Mežaparks, London's Hyde
// Park. Merged into each country's list on the phone (worldStory). Grounds
// are big, so they take a stadium's reach ("s"). Add to it when a member's
// concert at a missing place isn't found.

export const EXTRA_VENUES: Record<string, [string, number, number, "s" | "a" | "m" | "t", string[]][]> = {
  EE: [
    ["Tallinn Song Festival Grounds", 59.4434, 24.8127, "s", ["Tallinna Lauluväljak", "Lauluväljak", "Song Festival Grounds"]],
    ["Unibet Arena", 59.4263, 24.654, "a", ["Saku Suurhall", "Saku Arena"]],
  ],
  LV: [["Mežaparks Grand Stage", 57.0019, 24.1427, "s", ["Mežaparka Lielā estrāde", "Mezaparks Grand Stage", "Mežaparks"]]],
  LT: [["Vingis Park", 54.6833, 25.2366, "s", ["Vingio parkas", "Vingis Park Amphitheatre", "Vingio parko estrada"]]],
  FI: [
    ["Kaisaniemi Park", 60.1755, 24.9465, "s", ["Kaisaniemen puisto", "Kaisaniemi"]],
    ["Suvilahti", 60.1876, 24.9715, "s", ["Suvilahti Helsinki", "Flow Festival"]],
  ],
  NO: [
    ["Unity Arena", 59.897, 10.628, "a", ["Telenor Arena", "Fornebu Arena"]],
    ["Valle Hovin", 59.9178, 10.7914, "s", ["Valle Hovin Stadion"]],
  ],
  PL: [
    ["PGE Narodowy", 52.2394, 21.0458, "s", ["Stadion Narodowy", "National Stadium Warsaw"]],
    ["Tauron Arena Kraków", 50.0675, 19.9918, "a", ["Tauron Arena"]],
    ["Atlas Arena", 51.7586, 19.4284, "a", ["Atlas Arena Łódź"]],
  ],
  GB: [
    ["Hyde Park", 51.5085, -0.1593, "s", ["British Summer Time Hyde Park", "BST Hyde Park", "Hyde Park London"]],
    ["Finsbury Park", 51.5711, -0.1048, "s", ["Finsbury Park London"]],
  ],
};
