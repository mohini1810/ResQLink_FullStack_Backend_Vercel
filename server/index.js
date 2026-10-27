import "dotenv/config";
import app from "../api/index.js";

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`ResQLink API running at http://localhost:${port}`));
