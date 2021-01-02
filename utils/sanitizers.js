const sanitizeObject = (obj) => {
  for (var key of Object.keys(obj)) {
    obj[key] = sanitizeString(obj[key]);
  }
}

const sanitizeString = (str) => {
  return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
}

module.exports = {
	sanitizeObject,
	sanitizeString
}