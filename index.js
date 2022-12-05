"use strict";

const path = require("path");
const fs = require("fs");
const glob = require("glob");
const minimatch = require("minimatch");
const mime = require("mime-types");
const AWS = require("aws-sdk");

module.exports = class Uploader {
  constructor({
    bucket,
    destination,
    distribution,
    clean = true,
    fileProperties = {},
    distributionPath = "/*",
  }) {
    this.s3 = new AWS.S3();
    this.bucket = bucket;
    this.bucketPath = destination;
    this.files = [];
    this.exclude = [];
    this.clean = clean;
    this.fileProperties = fileProperties;

    if (distribution) {
      this.invalidate = true;
      this.cloudFront = new AWS.CloudFront();
      this.distribution = distribution;
      this.invalidationPath =
        typeof distributionPath === "string"
          ? [distributionPath]
          : distributionPath;
    }
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

  uploadFiles = async () => {
    console.log("Starting upload");

    for (let file of this.files) {
      if (this.validateFile(file) === false) continue;

      // additional file properties like headers.
      const properties = this.getFileProperties(file);

      const params = {
        Bucket: this.bucket,
        Key: path.join(this.bucketPath, file.basePath),
        Body: fs.readFileSync(file.path),
        ContentType: mime.lookup(file.path),
        ...properties,
      };

      try {
        await this.s3.putObject(params).promise();
        console.log(
          `Uploaded ${file.path} to bucket: ${params.Bucket}/${params.Key}`
        );
      } catch (error) {
        console.error(
          `Error while uploading ${file} to bucket: ${params.Bucket}/${params.Key}`,
          error
        );
      }
    }

    console.log("Upload completed!");
  };

  cleanDestination = async () => {
    if (this.clean === false) return;

    console.log("Cleaning destination");

    const listParams = { Bucket: this.bucket, Prefix: this.bucketPath };
    const listedObjects = await this.s3.listObjectsV2(listParams).promise();
    if (listedObjects.Contents.length === 0) return;

    const deleteObjects = listedObjects.Contents.map(({ Key }) => ({ Key }));
    const deleteParams = {
      Bucket: this.bucket,
      Delete: { Objects: deleteObjects },
    };
    await this.s3.deleteObjects(deleteParams).promise();

    // s3 returns list as chunks which needs to be recursively fetched. isTruncated becomes false if all items are returned.
    if (listedObjects.IsTruncated) await this.cleanDestination();
    else console.log("Destination is now clean!");
  };

  invalidateDistribution = async () => {
    if (this.invalidate !== true) return;

    const params = {
      DistributionId: this.distribution,
      InvalidationBatch: {
        CallerReference: `${+new Date()}`,
        Paths: {
          Items: this.invalidationPath,
          Quantity: this.invalidationPath.length,
        },
      },
    };

    await this.cloudFront.createInvalidation(params).promise();
    console.log("Distribution invalidation created!");
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

  upload = async () => {
    await this.cleanDestination();
    await this.uploadFiles();
    await this.invalidateDistribution();
  };
};
