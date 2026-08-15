export type Territory = {
  numeric: string; // ISO 3166-1 numeric, matches world-atlas geography ids
  code: string; // ISO 3166-1 alpha-2 (or closest widely-used code)
  name: string;
};

// Non-sovereign territories and dependencies — travelers commonly track
// these alongside the 195 recognised countries, but they deliberately don't
// count toward TOTAL_COUNTRIES. Genuinely disputed sovereignty cases
// (Taiwan, Kosovo, Northern Cyprus, Western Sahara, Somaliland) are left out
// on purpose rather than us deciding that for the user.
export const TERRITORIES: Territory[] = [
  { numeric: "010", code: "AQ", name: "Antarctica" },
  { numeric: "304", code: "GL", name: "Greenland" },
  { numeric: "744", code: "SJ", name: "Svalbard and Jan Mayen" },

  { numeric: "234", code: "FO", name: "Faroe Islands" },
  { numeric: "292", code: "GI", name: "Gibraltar" },
  { numeric: "833", code: "IM", name: "Isle of Man" },
  { numeric: "832", code: "JE", name: "Jersey" },
  { numeric: "831", code: "GG", name: "Guernsey" },
  { numeric: "248", code: "AX", name: "Åland Islands" },

  { numeric: "344", code: "HK", name: "Hong Kong" },
  { numeric: "446", code: "MO", name: "Macau" },

  { numeric: "630", code: "PR", name: "Puerto Rico" },
  { numeric: "850", code: "VI", name: "US Virgin Islands" },
  { numeric: "092", code: "VG", name: "British Virgin Islands" },
  { numeric: "136", code: "KY", name: "Cayman Islands" },
  { numeric: "060", code: "BM", name: "Bermuda" },
  { numeric: "533", code: "AW", name: "Aruba" },
  { numeric: "531", code: "CW", name: "Curaçao" },
  { numeric: "534", code: "SX", name: "Sint Maarten" },
  { numeric: "796", code: "TC", name: "Turks and Caicos Islands" },
  { numeric: "660", code: "AI", name: "Anguilla" },
  { numeric: "500", code: "MS", name: "Montserrat" },
  { numeric: "312", code: "GP", name: "Guadeloupe" },
  { numeric: "474", code: "MQ", name: "Martinique" },

  { numeric: "316", code: "GU", name: "Guam" },
  { numeric: "016", code: "AS", name: "American Samoa" },
  { numeric: "580", code: "MP", name: "Northern Mariana Islands" },
  { numeric: "258", code: "PF", name: "French Polynesia" },
  { numeric: "540", code: "NC", name: "New Caledonia" },
  { numeric: "184", code: "CK", name: "Cook Islands" },
  { numeric: "570", code: "NU", name: "Niue" },

  { numeric: "254", code: "GF", name: "French Guiana" },
  { numeric: "638", code: "RE", name: "Réunion" },
  { numeric: "175", code: "YT", name: "Mayotte" },
  { numeric: "238", code: "FK", name: "Falkland Islands" },
  { numeric: "654", code: "SH", name: "Saint Helena" },
];

export const TOTAL_TERRITORIES = TERRITORIES.length;

const byNumeric = new Map(TERRITORIES.map((t) => [t.numeric, t]));
const byCode = new Map(TERRITORIES.map((t) => [t.code, t]));

export function territoryByNumeric(numeric: string): Territory | undefined {
  return byNumeric.get(numeric);
}

export function territoryByCode(code: string | null | undefined): Territory | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}
