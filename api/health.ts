interface ServerlessReq {
  method?: string;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (body: unknown) => void;
}

export default function handler(_req: ServerlessReq, res: ServerlessRes) {
  res.status(200).json({ ok: true });
}
