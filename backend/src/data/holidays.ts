// Copied from the "Holiday calendar '26" tab of the Office sheet.
// Temporary: in step 2 this moves into the PostgreSQL database.

export type Holiday = {
  date: string; // "YYYY-MM-DD", the format databases and JavaScript understand
  name: string;
  type: "Gazetted" | "Compulsory";
};

export const holidays: Holiday[] = [
  { date: "2026-01-01", name: "New Year", type: "Gazetted" },
  { date: "2026-01-26", name: "Republic Day", type: "Compulsory" },
  { date: "2026-03-03", name: "Choti Holi", type: "Gazetted" },
  { date: "2026-03-04", name: "Holi", type: "Gazetted" },
  { date: "2026-08-15", name: "Independence Day", type: "Compulsory" },
  { date: "2026-08-28", name: "Rakhi", type: "Gazetted" },
  { date: "2026-10-02", name: "Gandhi Jayanti", type: "Compulsory" },
  { date: "2026-11-07", name: "Choti Diwali", type: "Gazetted" },
  { date: "2026-11-08", name: "Diwali", type: "Gazetted" },
  { date: "2026-11-10", name: "Govardhan", type: "Gazetted" },
  { date: "2026-11-11", name: "Bhai Dooj", type: "Gazetted" },
  { date: "2026-12-25", name: "Christmas", type: "Gazetted" },
];
