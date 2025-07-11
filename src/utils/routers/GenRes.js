const GenRes = (status, data, error, message) => {
  const res = {
    status,
    data: data || null,
    error: error || null,
    message: message ? message : error ? "Errored" : "Success",
  };

  if (error) {
    console.log(error);
  }
  return res;
};

module.exports = GenRes;
