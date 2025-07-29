//Buttons 
document.getElementById("convertButton").addEventListener("click", handleFile);
document.getElementById("copyButton").addEventListener("click", copyCode);

//Upload 
function handleFile() {
    const file = document.getElementById('jsonFile').files[0];
    if (!file) {
        alert("Please load a JSON Postman file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const postmanJson = JSON.parse(e.target.result);
            const modifiedJson = replaceDoubleCurlyBraces(postmanJson);
            console.log("Modified Postman JSON:", modifiedJson);

            const dynatraceJson = convertToDynatrace(modifiedJson);
            const outputElement = document.getElementById('output');
            outputElement.textContent = JSON.stringify(dynatraceJson, null, 2);

            document.getElementById("copyButton").disabled = false;
        } catch (error) {
            alert("Error during conversion. Ensure the file is a valid Postman JSON.");
            console.error("Conversion error:", error);
        }
    };

    reader.readAsText(file);
}

//remove double Curly brackets
function replaceDoubleCurlyBraces(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/\{\{(.*?)\}\}/g, '{$1}');
        } else if (typeof obj[key] === 'object') {
            replaceDoubleCurlyBraces(obj[key]);
            if (obj[key]?.raw && typeof obj[key].raw === 'string') {
                obj[key].raw = obj[key].raw.replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/\{\{(.*?)\}\}/g, '{$1}');
            }
        }
    }
    return obj;
}

//Conversion based on requests
function convertToDynatrace(postmanJson) {
    const dynatraceJson = {
        version: "1.0",
        requests: []
    };

    if (!postmanJson.item || !Array.isArray(postmanJson.item)) {
        alert("The file is not a valid Postman collection.");
        return dynatraceJson;
    }

    postmanJson.item.forEach(requestItem => {
        const requestDetails = requestItem.request;
        const url = requestDetails.url?.raw || "N/A";

        const dynatraceRequest = {
            description: requestItem.name || "Untitled",
            url,
            method: requestDetails.method || "GET",
            validation: {
                rules: [{ type: "httpStatusesList", value: ">=400", passIfFound: false }]
            },
            configuration: {
                acceptAnyCertificate: true,
                followRedirects: true,
                shouldNotPersistSensitiveData: false
            }
        };
//Body
        if (requestDetails.body) {
            const body = requestDetails.body;
            if (body.mode === "raw") {
                dynatraceRequest.requestBody = body.raw;
            } else if (body.mode === "urlencoded") {
                if (body.urlencoded && Array.isArray(body.urlencoded)) {
                    dynatraceRequest.requestBody = body.urlencoded.map(param =>
                        `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`
                    ).join('&');
                } else {
                    console.warn("No valid urlencoded data found. Check your Postman JSON.");
                }
            }
        }
//Headers
        if (requestDetails.header && Array.isArray(requestDetails.header)) {
            dynatraceRequest.configuration.requestHeaders = requestDetails.header.map(header => ({
                name: header.key,
                value: header.value
            }));
        }
//Pre and Post-execution
        const events = requestItem.event || [];
        events.forEach(event => {
            if (event.listen === "test" || event.listen === "prerequest") {
                let scriptLines = event.script.exec.map(line =>
                    line
                        .replace(/pm\.response\.json/g, 'jsonData')
                        .replace(/pm\.environment\.set/g, 'api.setValue')
                        .replace(/pm\.collectionVariables\.set/g, 'api.setValue')
                        .replace(/pm\.collectionVariables\.get/g, 'api.getValue')
                        .replace(/pm\.globals\.set/g, 'api.setGlobal')
                        .replace(/pm\.globals\.get/g, 'api.getGlobal')
                        .replace(/console\.log/g, 'api.info')
                        .replace(/console\.warn/g, 'api.warn')
                        .replace(/console\.error/g, 'api.error')
                        .replace(/pm\.test/g, 'api.createSyntheticTest')
                        .replace(/pm\.response\.code/g, 'api.getResponseCode()')
                        .replace(/pm\.response\.status/g, 'api.getResponseStatus()')
                        .replace(/pm\.expect/g, 'api.setExpectation')
                        .replace(/pm\.preRequest/g, 'api.preExecute()')
                        .replace(/pm\.response\.text/g, 'response.getResponseBody')
                        .replace(/postman\.getResponseHeader/g, 'response.getHeader')
                        .replace(/postman\.setEnvironmentVariable/g, 'api.setValue')
                );

                if (event.listen === "test") {
                    scriptLines.unshift("var responseBody = response.getResponseBody();", "var jsonData = JSON.parse(responseBody);");
                    dynatraceRequest.postProcessingScript = scriptLines.join("\n");
                } else { // prerequest
                    dynatraceRequest.preProcessingScript = scriptLines.join("\n");
                }
            }
        });

        dynatraceJson.requests.push(dynatraceRequest);
    });

    return dynatraceJson;
}
//Copy output code
function copyCode() {
    const outputElement = document.getElementById("output");
    if (!outputElement?.textContent) {
        console.error("No text to copy.");
        return;
    }

    navigator.clipboard.writeText(outputElement.textContent)
        .then(() => {
            const copyButton = document.getElementById('copyButton');
            copyButton.textContent = "Copied!";
            copyButton.style.backgroundColor = "#048855";
            copyButton.style.color = "#ffffff";
            setTimeout(() => {
                copyButton.textContent = "Copy Code";
                copyButton.style.backgroundColor = "";
                copyButton.style.color = "";
            }, 2000);
        })
        .catch(err => {
            console.error("Failed to copy: ", err);
        });
}