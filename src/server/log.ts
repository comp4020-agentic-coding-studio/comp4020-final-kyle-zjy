// One JSON line per event on stdout, which `fly logs` collects.
type Fields = Record<string, unknown>;

const write = (level: string, msg: string, fields?: Fields): void => {
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }));
};

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
