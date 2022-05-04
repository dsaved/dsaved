// Usage of file uploa multiple

// const uploader = new Uploader();
// let [upload, location] = uploader.multiple({ key: 'files', allowedFile: Uploader.IMAGE });
// upload(request, response, async(error) => {
//     if (error) {
//         response.status(403).json({ success: false, message: error });
//     } else {
//         const filenames = uploader.getFilenames();

//         let fileDir = [];
//         for (let index = 0; index < filenames.length; index++) {
//             const filename = filenames[index];
//             fileDir.push(location + filename)
//         }

//         console.log(fileDir)
//     }
// })

// const uploader = new Uploader();
// let [upload, location] = uploader.single({ key: 'photo', allowedFile: Uploader.IMAGE });
// upload(request, response, async(error) => {
//     if (error) {
//         response.status(403).json({ success: false, message: error });
//     } else {
//         const filename = uploader.getFilename();
//         const fileDir = location + filename;

//         console.log(fileDir)
//     }
// })

const public = './public'
const uploadDir = `uploads`;
const destination = `${public}/${uploadDir}`;

//file import
const path = require('path');
const multer = require('multer');
const fs = require('fs');

class Uploader {

    static IMAGE = { name: "Image", fileType: /gif|jpeg|png|svg|jpg/, mimetype: /image\/*/ };
    static EXCEL = { name: "Excel", fileType: /xlsx|xls/, mimetype: /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet|application\/vnd.ms-excel/ };

    _fileName = "";
    _fileNames = [];

    constructor() {}

    setFileName(filename) {
        this._fileName = filename;
    }

    addFilename(filename) {
        this._fileNames.push(filename);
    }

    getFilename() {
        return this._fileName;
    }

    getFilenames() {
        return this._fileNames;
    }

    getDistination() {
        return destination;
    }

    fields({ key = 'file', fields = [], allowedFile = FileUpload.IMAGE, maxSize = 5 * 1000 * 1000 }) {
        if (!fs.existsSync(`${destination}/${key}`)) {
            fs.mkdirSync(`${destination}/${key}`, { recursive: true });
        }

        const upload = multer({
            storage: multer.diskStorage({
                destination: `${destination}/${key}`,
                filename: (req, file, callback) => {
                    const _fileName = file.originalname + '-' + Date.now() + path.extname(file.originalname);
                    this.setFileName(_fileName)
                    callback(null, _fileName);
                }
            }),
            limits: { fileSize: maxSize },
            fileFilter: (request, file, callback) => {
                //check extension
                const extname = allowedFile.fileType.test(path.extname(file.originalname).toLowerCase());
                //check mime type
                const mimetype = allowedFile.mimetype.test(file.mimetype);
                if (extname && mimetype) {
                    callback(null, true);
                } else {
                    callback(`please upload ${allowedFile.name} files only`);
                }
            }
        }).fields(fields)
        return upload
    }

    single({ key = 'file', allowedFile = FileUpload.IMAGE, maxSize = 5 * 1000 * 1000 }) {

        if (!fs.existsSync(`${destination}/${key}`)) {
            fs.mkdirSync(`${destination}/${key}`, { recursive: true });
        }

        const upload = multer({
            storage: multer.diskStorage({
                destination: `${destination}/${key}`,
                filename: (req, file, callback) => {
                    const _fileName = file.originalname + '-' + Date.now() + path.extname(file.originalname);
                    this.setFileName(_fileName)
                    callback(null, _fileName);
                }
            }),
            limits: { fileSize: maxSize },
            fileFilter: (request, file, callback) => {
                //check extension
                const extname = allowedFile.fileType.test(path.extname(file.originalname).toLowerCase());
                //check mime type
                const mimetype = allowedFile.mimetype.test(file.mimetype);
                if (extname && mimetype) {
                    callback(null, true);
                } else {
                    callback(`please upload ${allowedFile.name} files only`);
                }
            }
        }).single(key);
        let location = `${uploadDir}/${key}/`
        return [upload, location]
    }

    multiple({ key = 'file', maxCount = Infinity, allowedFile = FileUpload.IMAGE, maxSize = 5 * 1000 * 1000 }) {

        if (!fs.existsSync(`${destination}/${key}`)) {
            fs.mkdirSync(`${destination}/${key}`, { recursive: true });
        }

        const upload = multer({
            storage: multer.diskStorage({
                destination: `${destination}/${key}`,
                filename: (req, file, callback) => {
                    const _fileName = file.originalname + '-' + Date.now() + path.extname(file.originalname);
                    this.addFilename(_fileName)
                    callback(null, _fileName);
                }
            }),
            limits: { fileSize: maxSize },
            fileFilter: (request, file, callback) => {
                //check extension
                const extname = allowedFile.fileType.test(path.extname(file.originalname).toLowerCase());
                //check mime type
                const mimetype = allowedFile.mimetype.test(file.mimetype);
                if (extname && mimetype) {
                    callback(null, true);
                } else {
                    callback(`please upload ${allowedFile.name} files only`);
                }
            }
        }).array(key, maxCount);
        let location = `${uploadDir}/${key}/`
        return [upload, location]
    }
}

module.exports = Uploader