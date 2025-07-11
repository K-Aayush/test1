class ModelGenerator {
  // unique data
  unique = (type, opt = {}) => {
    const val = {
      type,
      required: true,
      unique: true,
    };
    Object.keys(opt)?.forEach((key) => {
      val[key] = opt?.[key];
    });
    return val;
  };

  required = (type, opt = {}) => {
    const val = {
      type,
      required: true,
    };
    Object.keys(opt)?.forEach((key) => {
      val[key] = opt?.[key];
    });
    return val;
  };
}
module.exports = ModelGenerator;
