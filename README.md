# s3-up

Upload your local files and directories directly to S3 🪣 with NodeJS. Particulary useful if you are having a S3 served website.
This library can be used as part of your build pipeline to deploy new assets. Uploads multiple individual files and directory contents together to a common S3 path.
</br>

## Installation

**npm**

```sh
npm install --save-dev https://github.com/bigbinary/s3-uploader
```

**yarn**

```sh
yarn add --dev https://github.com/bigbinary/s3-uploader
```

## Usage

#### Basic Usage

```js
const Uploader = require("@bigbinary/s3-uploader");

const uploader = new Uploader({
  bucket: "s3-bucket-name",
  path: "target-bucket-path",
});

// add individual file
uploader.addFile("path-to-file");

// add all files in a directory
uploader.addDir("path-to-source-dir");

// start upload
uploader.upload();

// Note: all local paths are expected to be relative to the current working directory - process.cwd()
```

</br>

#### Configuration

```js
new Uploader(configuration);
```

`configuration` object can have following properties to control the behavior of the uploader:

⚙️ **`bucket`** : _(String)_ Name of the bucket of the target S3 bucket.

⚙️ **`path`** : _(String)_ Path to the target directory in bucket where files should be uploaded.

⚙️ **`clean`** : _(Boolean: true)_ Indicates whether target directory and contents should be removed before starting upload. Setting this false will skip this feature.

⚙️ **`fileProperties`** : _(Object: {})_ key-value pairs that providers additional file properties.
key should be a valid Unix style pattern to match file and value should be an object with additional file properties.

⚙️ **`distribution`** : _(String)_ CloudFront distribution id if you want to invalidate the distribution after successfull upload.

⚙️ **`distributionPath`** : _(String: '/\*' | Array)_ CloudFront distribution path if you want to invalidate only a particular path within the distribution. If you want to target multiple paths, use an array of strings. Supports UNIX style path patterns.

</br>

By default, the library attempts to find matching `ContentType` for each uploaded file using `mime-type` module.
You can override the default properties or assign additional properties for a matching file as follows.
The configuration for first matching key pattern will be used.

```js
uploader.fileProperties: {
  "*.js": {
    ContentType: "text/javascript",
    ContentEncoding: "gzip"
  }
}
```
