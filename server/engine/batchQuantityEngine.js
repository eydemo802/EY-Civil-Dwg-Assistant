const {
    calculateQuantity
} = require("./quantityEngine");

function roundValue(value) {
    return Number(
        Number(value || 0)
            .toFixed(4)
    );
}

function calculateQuantities(
    annotations = []
) {
    const successfulCalculations = [];
    const reviewItems = [];

    for (const annotation of annotations) {
        try {
            const result =
                calculateQuantity(
                    annotation
                );

            successfulCalculations.push(
                result
            );

        } catch (error) {
            reviewItems.push({
                sourceText:
                    annotation,
                status:
                    "review",
                reason:
                    error.message
            });
        }
    }

    //-----------------------------------
    // SUMMARY
    //-----------------------------------

    const totalVolume =
        successfulCalculations.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.volume || 0
                ),
            0
        );

    const totalArea =
        successfulCalculations.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.area || 0
                ),
            0
        );

    const totalShutteringArea =
        successfulCalculations.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.shutteringArea ||
                    0
                ),
            0
        );

    const shutteringCalculatedCount =
        successfulCalculations.filter(
            item =>
                item.shutteringStatus ===
                "Calculated"
        ).length;

    const shutteringReviewCount =
        successfulCalculations.filter(
            item =>
                item.shutteringStatus ===
                "Review Required"
        ).length;

    return {
        successfulCalculations,
        reviewItems,

        summary: {
            totalAnnotations:
                annotations.length,

            successfulCount:
                successfulCalculations.length,

            reviewCount:
                reviewItems.length,

            totalVolume:
                roundValue(
                    totalVolume
                ),

            totalArea:
                roundValue(
                    totalArea
                ),

            totalShutteringArea:
                roundValue(
                    totalShutteringArea
                ),

            shutteringCalculatedCount,
            shutteringReviewCount
        }
    };
}

module.exports = {
    calculateQuantities
};
