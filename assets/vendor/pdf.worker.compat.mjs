/* pdf.js worker entry: add the missing built-ins first, then start the real worker. */
import "./pdf-compat.mjs";
import "./pdf.worker.min.mjs";
