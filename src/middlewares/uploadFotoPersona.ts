import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const mimetypesPermitidos = ["image/jpeg", "image/png", "image/jpg"];
  if (mimetypesPermitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_FILE_TYPE"));
  }
};

export const uploadFotoPersonaMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter,
});
