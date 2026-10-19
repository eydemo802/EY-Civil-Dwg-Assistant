function convertDimensionsToMeters(
    normalizedDimensions
) {

    const converted = {};

    for (const [dimensionName, data]
        of Object.entries(normalizedDimensions)) {

        let value = data.value;
        let targetUnit = data.unit;

        switch (
            data.unit.toLowerCase()
        ) {

            case "mm":

                value = value / 1000;
                targetUnit = "m";
                break;

            case "cm":

                value = value / 100;
                targetUnit = "m";
                break;

            case "m":

                value = value;
                targetUnit = "m";
                break;

            default:

                value = value;
                targetUnit = data.unit;
                break;
        }

        converted[dimensionName] = {

            ...data,

            originalValue:
                data.value,

            originalUnit:
                data.unit,

            value,

            unit:
                targetUnit
        };
    }

    return converted;
}

module.exports = {
    convertDimensionsToMeters
};