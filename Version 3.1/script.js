document.addEventListener("DOMContentLoaded", () => {
    // Event listeners for existing functionalities
    document.getElementById("convertButton").addEventListener("click", handleFile);
    document.getElementById("copyButton").addEventListener("click", copyCode);

    document.getElementById('convertButton').addEventListener('click', () => {
        document.getElementById('show-params').style.display = 'block'; // Show button
        document.getElementById('custom-params-content').style.display = 'none'; // Hide params
    });

    // Event listeners for key-value storage
    document.getElementById("storeBtn").addEventListener("click", storeKeyValue);
    document.getElementById("retrieveBtn").addEventListener("click", retrieveKeyValue);
    document.getElementById("clearBtn").addEventListener("click", clearStorage);

    updateStorageList();
});

// Function to handle file loading and conversion
function handleFile() {
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please load a JSON Postman file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let postmanJson = JSON.parse(e.target.result);
            postmanJson = replaceDoubleCurlyBraces(postmanJson);

            console.log("Modified Postman JSON:", postmanJson);

            const dynatraceJson = convertToDynatrace(postmanJson);
            document.getElementById('output').textContent = JSON.stringify(dynatraceJson, null, 2);
            document.getElementById("copyButton").disabled = false;

        } catch (error) {
            alert("Error during conversion. Ensure the file is a valid Postman JSON.");
            console.error("Conversion error:", error);
        }
    };

    reader.readAsText(file);
}

// Function to replace double curly braces in JSON
function replaceDoubleCurlyBraces(obj) {
    for (let key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/\{\{(.*?)\}\}/g, '{$1}');
        } else if (typeof obj[key] === 'object') {
            replaceDoubleCurlyBraces(obj[key]);
            if (obj[key] && obj[key].raw && typeof obj[key].raw === 'string') {
                obj[key].raw = obj[key].raw.replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/\{\{(.*?)\}\}/g, '{$1}');
            }
        }
    }
    return obj;
}

// Function to convert Postman JSON to Dynatrace format
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
            url: url,
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

        if (requestDetails.body) {
            if (requestDetails.body.mode === "raw") {
                dynatraceRequest.requestBody = requestDetails.body.raw;
            } else if (requestDetails.body.mode === "urlencoded") {
                let formattedString = "";
                if (requestDetails.body.urlencoded && Array.isArray(requestDetails.body.urlencoded)) {
                    requestDetails.body.urlencoded.forEach(param => {
                        formattedString += `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}&`;
                    });
                    formattedString = formattedString.slice(0, -1);
                    dynatraceRequest.requestBody = formattedString;
                }
            }
        }

        if (requestDetails.header && Array.isArray(requestDetails.header)) {
            dynatraceRequest.configuration.requestHeaders = requestDetails.header.map(header => ({
                name: header.key,
                value: header.value
            }));
        }

        dynatraceJson.requests.push(dynatraceRequest);
    });

    return dynatraceJson;
}

// Function to copy output to clipboard
function copyCode() {
    const outputElement = document.getElementById("output");

    if (outputElement && outputElement.textContent) {
        navigator.clipboard.writeText(outputElement.textContent)
            .then(() => {
                const copyButton = document.getElementById('copyButton');
                copyButton.textContent = "Copied!";
                copyButton.style.backgroundColor = "green";
                setTimeout(() => {
                    copyButton.textContent = "Copy Code";
                    copyButton.style.backgroundColor = "";
                }, 2000);
            })
            .catch(err => console.error("Failed to copy: ", err));
    } else {
        console.error("No text to copy.");
    }
}

// ===============================
// Key-Value Storage Functionality
// ===============================

// Store key-value pair
function storeKeyValue() {
    const key = document.getElementById("keyInput").value.trim();
    const value = document.getElementById("valueInput").value.trim();

    if (key && value) {
        localStorage.setItem(key, value);
        alert(`Stored: ${key} -> ${value}`);
        document.getElementById("keyInput").value = "";
        document.getElementById("valueInput").value = "";
        updateStorageList();
    } else {
        alert("Please enter both key and value.");
    }
}

// Retrieve value by key
function retrieveKeyValue() {
    const key = document.getElementById("retrieveKeyInput").value.trim();
    const storedValue = localStorage.getItem(key);

    if (storedValue !== null) {
        document.getElementById("output").textContent = `Retrieved: ${key} -> ${storedValue}`;
    } else {
        document.getElementById("output").textContent = "Key not found.";
    }
}

// Clear all local storage data
function clearStorage() {
    if (confirm("Are you sure you want to clear all stored data?")) {
        localStorage.clear();
        updateStorageList();
        document.getElementById("output").textContent = "";
        alert("Local storage cleared.");
    }
}

// Update displayed stored items
function updateStorageList() {
    const storageList = document.getElementById("storageList");
    storageList.innerHTML = "<h3>Stored Items:</h3>";

    if (localStorage.length === 0) {
        storageList.innerHTML += "<p>No data stored.</p>";
        return;
    }

    Object.keys(localStorage).forEach(key => {
        storageList.innerHTML += `<p><strong>${key}</strong>: ${localStorage.getItem(key)}</p>`;
    });
}