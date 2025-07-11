const path = require("path");
const GenRes = require("../../utils/routers/GenRes");
const fs = require("fs");

const MultipleFiles = async (req, res) => {
  try {
    console.log("FILES : ", req?.files);
    const file_locations = req?.file_locations;
    console.log(file_locations);
    const response = GenRes(
      200,
      file_locations,
      null,
      "Uplodaed Successfully!"
    );
    return res.status(200).json(response);
  } catch (error) {
    const response = GenRes(500, null, error, error?.message);
    return res.status(500).json(response);
  }
};

const SingleFile = async (req, res) => {
  try {
    const file_location = req?.file_location;
    const response = GenRes(
      200,
      { failures: file_location },
      null,
      "Uplodaed Successfully!"
    );
    return res.status(200).json(response);
  } catch (error) {
    const response = GenRes(500, null, error, error?.message);
    return res.status(500).json(response);
  }
};

const DeleteFiles = async (req, res) => {
  try {
    const filesList = req?.body;
    console.log("filelist", filesList);
    if (!filesList || !Array.isArray(filesList) || filesList.length === 0) {
      const response = GenRes(
        400,
        null,
        new Error("Files location must be provided in array"),
        "Please provide location in valid format"
      );
      return res.status(400).json(response);
    }

    const failedFile = [];

    for (const file of filesList) {
      try {
        fs.unlinkSync(path.join(process.cwd(), file.slice(1)));
      } catch (error) {
        console.log(error?.message);
        failedFile.push(file);
      }
    }

    const response = GenRes(
      failedFile?.length > 0 ? 207 : 200,
      { failedFile },
      null,
      "Files Deleted"
    );

    return res.status(response?.status).json(response);
  } catch (error) {
    const response = GenRes(500, null, error, error?.message);
    return res.status(500).json(response);
  }
};

module.exports = { MultipleFiles, SingleFile, DeleteFiles };
