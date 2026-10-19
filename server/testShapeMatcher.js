const {
    matchShape
} = require("./config/shapeMatcher");

const result = matchShape(
    "Solid Cylinder"
);

console.log(
    JSON.stringify(
        result,
        null,
        4
    )
);