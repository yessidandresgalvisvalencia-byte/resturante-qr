"use strict";
const ALLOWED_DOMAINS=new Set(["bancolombia.com.co","bancolombia.com","nequi.com.co"]);
function remitenteVerificado(headers){
 if(!headers||typeof headers.from!=="string"||typeof headers["authentication-results"]!=="string")return false;
 const from=headers.from.trim();
 const match=from.match(/(?:^|<)([a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+))(?:>|$)/);
 if(!match)return false;
 const domain=match[2].toLowerCase();
 if(!ALLOWED_DOMAINS.has(domain))return false;
 const auth=headers["authentication-results"].toLowerCase();
 const dmarc=auth.match(/(?:^|[;\s])dmarc=pass\b[^;]*/);
 if(!dmarc)return false;
 const domainMatch=dmarc[0].match(/header\.from=([a-z0-9.-]+)/);
 return Boolean(domainMatch&&domainMatch[1]===domain);
}
module.exports={remitenteVerificado};
