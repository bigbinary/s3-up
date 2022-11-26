"use strict";

const path = require("path");
const fs = require("fs");
const glob = require("glob");
const minimatch = require("minimatch");
const AWS = require("aws-sdk");

module.exports = class Uploader {
  constructor({ bucket, destination }) {
    this.s3 = new AWS.S3();
    this.bucket = bucket;
    this.bucketPath = destination;
    this.files = [];
    this.exclude = [];
    this.fileProperties = {};
  }

  getFileProperties = (file) => {
    // fileProperties are expected to be key-value pairs. key is expected to be a pattern that matches current file
    // and value will be additional properties for the file matching the pattern.
    const key = Object.keys(this.fileProperties).find((pattern) =>
      minimatch(file.basePath, pattern)
    );

    return key ? this.fileProperties[key] : {};
  };

  validateFile = (file) => {
    const notExist = !fs.existsSync(file.path);
    if (notExist) {
      console.warn(`${file.path} not found. Skipped`);
      return false;
    }

    const notInclude = this.exclude.find((pattern) =>
      minimatch(file.basePath, pattern)
    );
    if (notInclude) return false;

    return true;
  };

  upload = async () => {
    for (let file of this.files) {
      if (this.validateFile(file) === false) continue;

      // additional file properties like headers.
      const properties = this.getFileProperties(file);

      const params = {
        Bucket: this.bucket,
        Key: path.join(this.bucketPath, file.basePath),
        Body: fs.readFileSync(file.path),
        ...properties,
      };

      try {
        await this.s3.putObject(params).promise();
        console.log(
          `Uploaded ${file} to bucket: ${params.Bucket}/${params.Key}`
        );
      } catch (error) {
        console.error(
          `Error while uploading ${file} to bucket: ${params.Bucket}/${params.Key}`,
          error
        );
      }
    }
  };

  addFile = (file) => {
    // add individual files by path;
    const fileObj = {};
    fileObj.path = file;
    fileObj.basePath = path.basename(file);
    this.files.push(fileObj);
  };

  addDir = (dir) => {
    // add all files in the given directory path recursively
    const files = glob.sync("*", { cwd: dir, nodir: true, matchBase: true });
    files.forEach((file) => {
      const fileObj = {};
      fileObj.path = path.join(dir, file);
      fileObj.basePath = file;
      this.files.push(fileObj);
    });
  };
};
