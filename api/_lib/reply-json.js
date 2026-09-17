/**
 * One parse for every model reply. All three calls ask for json_schema
 * output, so a body that is not JSON is the model's failure: the caller
 * names what it asked for, and the endpoint's catch turns that into the
 * sentence a person reads.
 */
export function parseModelJson(text, what) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what} was not valid JSON`);
  }
}
