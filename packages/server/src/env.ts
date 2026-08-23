import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM tüm `import` ifadelerini modül gövdesinden önce çalıştırır. dotenv.config()
// index.ts'in gövdesinde çağrılırsa, auth.ts ve db.ts gibi modüller kendi
// top-level sabitlerini (JWT_SECRET, DATABASE_URL) .env okunmadan ÖNCE hesaplar.
// Bu yüzden yükleme ayrı bir modüle alındı: index.ts bunu ilk import olarak
// çağırır, böylece diğer modüller değerlendirilmeden .env yüklenmiş olur.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
