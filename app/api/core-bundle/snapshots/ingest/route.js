import { POST as ingestSnapshot } from "../route";

export async function GET(req) {
  return ingestSnapshot(req);
}

export async function POST(req) {
  return ingestSnapshot(req);
}
