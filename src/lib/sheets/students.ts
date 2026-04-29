import { unstable_cache } from "next/cache";
import { readSheet } from "./read";
import { parseRows, StudentRow, type Student } from "./schemas";

export const fetchStudents = unstable_cache(
  async (): Promise<Student[]> => parseRows(await readSheet("Students!A:G"), StudentRow),
  ["students:all"],
  { revalidate: 300, tags: ["students"] },
);
