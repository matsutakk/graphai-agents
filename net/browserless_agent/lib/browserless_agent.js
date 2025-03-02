"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserlessAgent = void 0;
const browserlessAgent = async ({ namedInputs, params }) => {
    const { url, operation, options, headers, cookies } = namedInputs;
    const throwError = params?.throwError ?? false;
    const browserlessEndpoint = "https://chrome.browserless.io";
    const browserlessToken = process.env.BROWSERLESS_API_TOKEN;
    // Check if API token is provided
    if (!browserlessToken) {
        const errorMessage = "Browserless API token is required. Please set the BROWSERLESS_API_TOKEN environment variable.";
        throw new Error(errorMessage);
    }
    // Build the endpoint with token
    const endpoint = `${browserlessEndpoint}?token=${browserlessToken}`;
    // Select appropriate endpoint based on operation type
    const operationType = operation || "content";
    let apiPath;
    switch (operationType) {
        case "screenshot":
            apiPath = "/screenshot";
            break;
        case "content":
        default:
            apiPath = "/content";
            break;
    }
    const fullEndpoint = `${endpoint}${apiPath}`;
    // Build request body
    const requestBody = {
        url,
        ...options,
    };
    if (cookies && Array.isArray(cookies) && cookies.length > 0) {
        requestBody.cookies = cookies;
    }
    // Return request information in debug mode
    if (params?.debug) {
        return {
            url: fullEndpoint,
            method: "POST",
            headers: headers || { "Content-Type": "application/json" },
            body: requestBody,
        };
    }
    // API request options
    const fetchOptions = {
        method: "POST",
        headers: new Headers({
            "Content-Type": "application/json",
            ...(headers || {}),
        }),
        body: JSON.stringify(requestBody),
    };
    try {
        const response = await fetch(fullEndpoint, fetchOptions);
        if (!response.ok) {
            const status = response.status;
            const error = await response.text();
            if (throwError) {
                throw new Error(`Browserless HTTP error: ${status}`);
            }
            return {
                onError: {
                    message: `Browserless HTTP error: ${status}`,
                    status,
                    error,
                },
            };
        }
        // Process result based on response type
        const responseType = params?.type || (operationType === "screenshot" ? "buffer" : "text");
        switch (responseType) {
            case "json":
                return (await response.json());
            case "text":
                return (await response.text());
            case "buffer":
                return {
                    base64: Buffer.from(await response.arrayBuffer()).toString("base64"),
                    contentType: response.headers.get("Content-Type") || "application/octet-stream",
                };
            default:
                return (await response.text());
        }
    }
    catch (error) {
        if (throwError) {
            throw error;
        }
        return {
            onError: {
                message: error.message || "Unknown error occurred",
                error: error.toString(),
            },
        };
    }
};
exports.browserlessAgent = browserlessAgent;
const browserlessAgentInfo = {
    name: "browserlessAgent",
    agent: exports.browserlessAgent,
    mock: exports.browserlessAgent,
    inputs: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "URL of the web page to scrape or manipulate",
            },
            operation: {
                type: "string",
                enum: ["content", "screenshot"],
                description: "Type of operation to perform (content or screenshot)",
            },
            options: {
                type: "object",
                description: "Additional options for the operation (e.g., screenshot format settings)",
            },
            headers: {
                type: "object",
                description: "HTTP request headers",
            },
            cookies: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        value: { type: "string" },
                        domain: { type: "string" },
                    },
                },
                description: "Cookies to use with the request",
            },
        },
        required: ["url"],
    },
    output: {
        oneOf: [
            { type: "object" },
            { type: "string" },
            {
                type: "object",
                properties: {
                    base64: { type: "string" },
                    contentType: { type: "string" },
                },
            },
        ],
    },
    samples: [
        {
            inputs: {
                url: "https://www.example.com",
                operation: "content",
            },
            params: {
                debug: true,
            },
            result: {
                url: "https://chrome.browserless.io/content",
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: { url: "https://www.example.com" },
            },
        },
        {
            inputs: {
                url: "https://www.example.com",
                operation: "screenshot",
                options: {
                    fullPage: true,
                    type: "jpeg",
                    quality: 90,
                },
            },
            params: {
                debug: true,
            },
            result: {
                url: "https://chrome.browserless.io/screenshot",
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: {
                    url: "https://www.example.com",
                    fullPage: true,
                    type: "jpeg",
                    quality: 90,
                },
            },
        },
    ],
    description: "An agent that uses Browserless.io to fetch web page content and take screenshots of websites, with JavaScript execution support for retrieving data from SPAs and dynamic content",
    category: ["service"],
    author: "Receptron",
    repository: "https://github.com/receptron/graphai",
    license: "MIT",
    environmentVariables: ["BROWSERLESS_API_TOKEN"],
};
exports.default = browserlessAgentInfo;
