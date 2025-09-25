import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";

export const logging = pinoHttp({
  genReqId: (req) => req.headers["x-request-id"] as string || randomUUID(),
  customSuccessMessage: function (req, res) { 
    return `${req.method} ${req.url} -> ${res.statusCode}`; 
  },
  serializers: { 
    req(req) { 
      return { 
        id: req.id, 
        method: req.method, 
        url: req.url 
      }; 
    } 
  }
});