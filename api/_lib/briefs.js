/**
 * The Research briefs hub's store (Kate, Oct 20, 2026): one row a brief, in
 * a table of its own, made by scripts/ensure-schema.js on her word (db.js
 * ensureSchema runs BRIEFS_SCHEMA); nothing here creates it. The files
 * themselves (the paper, her notes, the drafts, the Word doc) live in the
 * brief's folder on the team drive, written through the Sheet's script; the
 * row keeps the folder's id and address, the stage, and the small text.
 *
 * Built over any query(text, params) -> rows function, like db.js: the tests
 * hand in a recorder; production hands in Neon.
 */

/** A paper over this comes back with a plain ask to shrink it: the function's
 *  body cap is 4.5 MB and base64 adds a third. */
export const MAX_PAPER_BYTES = 3 * 1024 * 1024;

export const BRIEFS_SCHEMA = `CREATE TABLE IF NOT EXISTS briefs (
      id text PRIMARY KEY,
      title text NOT NULL DEFAULT '',
      paper_title text NOT NULL DEFAULT '',
      authors text NOT NULL DEFAULT '',
      journal text NOT NULL DEFAULT '',
      year integer,
      design text NOT NULL DEFAULT '',
      author_of_record text NOT NULL DEFAULT '',
      stage text NOT NULL DEFAULT 'paper',
      stage_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL,
      folder_id text NOT NULL DEFAULT '',
      folder_url text NOT NULL DEFAULT '',
      paper_name text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      words integer NOT NULL DEFAULT 0,
      extra jsonb NOT NULL DEFAULT '{}'::jsonb
    )`;

export const NEEDS_DB = 'Research briefs need the database, and the desk is running on the Sheet.';
export const NO_TABLE = 'Research briefs need the database, and its briefs table is not set up yet.';

/** Postgres's undefined_table, 42P01, or its words when a driver drops the code. */
export function isMissingTable(err) {
  return err?.code === '42P01' || /relation "briefs" does not exist/.test(String(err?.message ?? ''));
}

const COLUMNS = ['id', 'title', 'paper_title', 'authors', 'journal', 'year', 'design', 'author_of_record', 'stage', 'stage_at', 'created_at', 'folder_id', 'folder_url', 'paper_name', 'notes', 'words', 'extra'];
const COLS = COLUMNS.join(', ');
const FIELD_OF = {
  title: 'title', paperTitle: 'paper_title', authors: 'authors', journal: 'journal', year: 'year', design: 'design', authorOfRecord: 'author_of_record',
  stage: 'stage', stageAt: 'stage_at', folderId: 'folder_id', folderUrl: 'folder_url', paperName: 'paper_name', notes: 'notes', words: 'words', extra: 'extra',
};

const isoOf = value => (value ? new Date(value).toISOString() : '');
const parsed = value => (typeof value === 'string' ? JSON.parse(value) : (value ?? {}));

/** One brief, the same shape everywhere the desk reads one. */
const entry = row => ({
  id: row.id, title: row.title ?? '', paperTitle: row.paper_title ?? '', authors: row.authors ?? '', journal: row.journal ?? '',
  year: row.year == null ? null : Number(row.year), design: row.design ?? '', authorOfRecord: row.author_of_record ?? '',
  stage: row.stage ?? 'paper', stageAt: isoOf(row.stage_at), createdAt: isoOf(row.created_at),
  folderId: row.folder_id ?? '', folderUrl: row.folder_url ?? '', paperName: row.paper_name ?? '', notes: row.notes ?? '',
  words: Number(row.words ?? 0), extra: parsed(row.extra),
});

export function createBriefs(query, { now = () => Date.now() } = {}) {
  return {
    /** Every brief, the newest move first. */
    async list() {
      const rows = await query(`SELECT ${COLS} FROM briefs ORDER BY stage_at DESC, id`);
      return rows.map(entry);
    },

    /** One brief, or null. */
    async get(id) {
      const [row] = await query(`SELECT ${COLS} FROM briefs WHERE id = $1`, [id]);
      return row ? entry(row) : null;
    },

    /** A new brief at the paper stage; answers its entry. */
    async create(b) {
      const at = new Date(now()).toISOString();
      const row = {
        id: b.id, title: b.title ?? '', paper_title: b.paperTitle ?? '', authors: b.authors ?? '', journal: b.journal ?? '', year: b.year ?? null,
        design: b.design ?? '', author_of_record: b.authorOfRecord ?? '', stage: 'paper', stage_at: at, created_at: at,
        folder_id: b.folderId ?? '', folder_url: b.folderUrl ?? '', paper_name: b.paperName ?? '', notes: b.notes ?? '', words: 0, extra: JSON.stringify(b.extra ?? {}),
      };
      const params = COLUMNS.map(c => row[c]);
      await query(`INSERT INTO briefs (${COLS}) VALUES (${COLUMNS.map((c, i) => (c === 'extra' ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')})`, params);
      return entry(row);
    },

    /** Change what the patch names (camelCase fields); answers the row as it now reads. */
    async update(id, patch) {
      const keys = Object.keys(patch).filter(k => FIELD_OF[k]);
      if (!keys.length) return this.get(id);
      const sets = keys.map((k, i) => `${FIELD_OF[k]} = $${i + 1}${k === 'extra' ? '::jsonb' : ''}`);
      const params = keys.map(k => (k === 'extra' ? JSON.stringify(patch[k] ?? {}) : patch[k]));
      const [row] = await query(`UPDATE briefs SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING ${COLS}`, [...params, id]);
      return row ? entry(row) : null;
    },
  };
}
