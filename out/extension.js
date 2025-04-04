"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const serverManager_1 = require("./server/serverManager");
const treeProvider_1 = require("./ui/treeProvider");
const serverModel_1 = require("./models/serverModel");
// Import from our visualization modules
const chartManager_1 = require("./visualization/chartManager");
const dataCollector_1 = require("./visualization/dataCollector");
const optionsCollector_1 = require("./visualization/optionsCollector");
const certificateManager_1 = require("./server/certificateManager");
const colorPickerUtils_1 = require("./utils/colorPickerUtils");
const fs = __importStar(require("fs"));
/**
 * This function is executed when the extension is activated
 */
function activate(context) {
    console.log('Extension "integracionvsaframe" is now active.');
    // Register tree data provider for the unified view
    const treeDataProvider = new treeProvider_1.LocalServerProvider(context);
    // Register tree view
    // Make sure this ID matches what's in package.json
    const treeView = vscode.window.createTreeView('integracionvsaframe.serverTreeView', {
        treeDataProvider: treeDataProvider
    });
    context.subscriptions.push(treeView);
    // COMMAND REGISTRATION
    // ===================
    // View Management Commands
    // -----------------------
    // Command to refresh the view
    const refreshViewCommand = vscode.commands.registerCommand('integracionvsaframe.refreshView', () => treeDataProvider.refresh());
    // Server Configuration Commands
    // ---------------------------
    // Command to change server mode
    const changeServerModeCommand = vscode.commands.registerCommand('integracionvsaframe.changeServerMode', (mode) => treeDataProvider.changeServerMode(mode));
    // Command to start server with current configuration
    const startServerWithConfigCommand = vscode.commands.registerCommand('integracionvsaframe.startServerWithConfig', async () => {
        const currentMode = context.globalState.get('serverMode') ||
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        try {
            // Configure file picker for HTML files
            const options = {
                canSelectMany: false,
                openLabel: 'Select HTML File',
                filters: { 'HTML': ['html', 'htm'] }
            };
            // Show file picker dialog
            const fileUri = await vscode.window.showOpenDialog(options);
            if (!fileUri || fileUri.length === 0) {
                return;
            }
            // Get full path of selected file
            const selectedFile = fileUri[0].fsPath;
            // Define server mode based on configuration
            const useHttps = currentMode !== serverModel_1.ServerMode.HTTP;
            const useDefaultCerts = currentMode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
            // Check for certificate existence if using default certs
            if (useHttps && useDefaultCerts && !(0, certificateManager_1.defaultCertificatesExist)(context)) {
                const warningResult = await vscode.window.showWarningMessage('Default SSL certificates not found. Server will not work with VR headsets. ' +
                    'Do you want to continue with HTTP instead?', 'Use HTTP', 'Cancel');
                if (warningResult === 'Use HTTP') {
                    // Fall back to HTTP
                    await (0, serverManager_1.startServer)(selectedFile, context, false, false);
                }
                return;
            }
            // Start server with selected configuration
            await (0, serverManager_1.startServer)(selectedFile, context, useHttps, useDefaultCerts);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Legacy command to start server (maintains compatibility)
    const startServerCommand = vscode.commands.registerCommand('integracionvsaframe.startLocalServer', async () => {
        try {
            // First, ask user if they want to use HTTPS
            const serverType = await vscode.window.showQuickPick(['HTTP', 'HTTPS (requires certificates)'], { placeHolder: 'Select server type' });
            if (!serverType) {
                return; // User cancelled the selection
            }
            const useHttps = serverType === 'HTTPS (requires certificates)';
            // Configure file picker for HTML files
            const options = {
                canSelectMany: false,
                openLabel: 'Select HTML File',
                filters: { 'HTML': ['html', 'htm'] }
            };
            // Show file picker dialog
            const fileUri = await vscode.window.showOpenDialog(options);
            if (!fileUri || fileUri.length === 0) {
                return;
            }
            const selectedFile = fileUri[0].fsPath;
            await (0, serverManager_1.startServer)(selectedFile, context, useHttps, false);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error starting server: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command to stop server
    const stopServerCommand = vscode.commands.registerCommand('integracionvsaframe.stopLocalServer', (serverId) => {
        (0, serverManager_1.stopServer)(serverId);
        treeDataProvider.refresh();
    });
    // Server Management Commands
    // -------------------------
    // Command to show options for an active server
    const serverOptionsCommand = vscode.commands.registerCommand('integracionvsaframe.serverOptions', async (serverInfo) => {
        try {
            const selection = await vscode.window.showQuickPick([
                { label: '$(globe) Open in Browser', id: 'open' },
                { label: '$(file-binary) View Server Info', id: 'info' },
                { label: '$(stop) Stop Server', id: 'stop' }
            ], {
                placeHolder: `Server ${serverInfo.url}`,
                title: `Options for ${path.basename(serverInfo.filePath)}`
            });
            if (!selection) {
                return;
            }
            if (selection.id === 'open') {
                vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
            }
            else if (selection.id === 'info') {
                // New functionality: Display detailed server info
                // Add null check for startTime
                const timeRunning = serverInfo.startTime
                    ? Math.floor((Date.now() - serverInfo.startTime) / 1000)
                    : 0;
                const minutes = Math.floor(timeRunning / 60);
                const seconds = timeRunning % 60;
                const infoMessage = `Server: ${serverInfo.url}\n` +
                    `Protocol: ${serverInfo.protocol.toUpperCase()}\n` +
                    `Port: ${serverInfo.port}\n` +
                    `File: ${serverInfo.filePath}\n` +
                    `Running time: ${minutes}m ${seconds}s`;
                vscode.window.showInformationMessage(infoMessage);
            }
            else if (selection.id === 'stop') {
                (0, serverManager_1.stopServer)(serverInfo.id);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error executing server action: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command for status bar actions
    const serverStatusActionsCommand = vscode.commands.registerCommand('integracionvsaframe.serverStatusActions', async () => {
        try {
            const activeServers = (0, serverManager_1.getActiveServers)();
            if (activeServers.length === 0) {
                vscode.window.showInformationMessage('No active servers');
                return;
            }
            // If there's only one server, show options directly
            if (activeServers.length === 1) {
                vscode.commands.executeCommand('integracionvsaframe.serverOptions', activeServers[0]);
                return;
            }
            // If there are multiple servers, show list to select
            const items = activeServers.map(server => ({
                label: path.basename(server.filePath),
                description: server.url,
                server: server
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a server',
            });
            if (selected) {
                vscode.commands.executeCommand('integracionvsaframe.serverOptions', selected.server);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error showing server status: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // BabiaXR Visualization Commands
    // ----------------------------
    // Command to create a BabiaXR visualization
    const createBabiaXRVisualizationCommand = vscode.commands.registerCommand('integracionvsaframe.createBabiaXRVisualization', async (chartType) => {
        try {
            // Collect chart data from user - pass context
            const chartData = await (0, dataCollector_1.collectChartData)(chartType, context);
            if (!chartData)
                return;
            // Collect chart-specific options
            const options = await (0, optionsCollector_1.collectChartOptions)(chartType);
            if (!options)
                return;
            // Generate visualization
            const filePath = await (0, chartManager_1.createBabiaXRVisualization)(chartType, chartData, context);
            if (filePath) {
                // Ask if user wants to launch server
                const launchServer = await vscode.window.showInformationMessage('Visualization created successfully. Do you want to start the server to view it?', 'Yes', 'No');
                if (launchServer === 'Yes') {
                    await (0, chartManager_1.launchBabiaXRVisualization)(filePath, context);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command to launch a BabiaXR example
    const launchBabiaXRExampleCommand = vscode.commands.registerCommand('integracionvsaframe.launchBabiaXRExample', async (examplePath) => {
        try {
            if (!examplePath) {
                vscode.window.showErrorMessage('No example path provided');
                return;
            }
            // Check if file exists
            if (!fs.existsSync(examplePath)) {
                vscode.window.showErrorMessage(`Example file not found: ${examplePath}`);
                return;
            }
            // Open the file in the editor first
            await vscode.window.showTextDocument(vscode.Uri.file(examplePath));
            // Ask if user wants to launch server
            const launchServer = await vscode.window.showInformationMessage('Do you want to start the server to view this example?', 'Yes', 'No');
            if (launchServer === 'Yes') {
                // Create a server for this example
                const serverMode = context.globalState.get('serverMode') ||
                    serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
                // Get the directory of the example rather than the file itself
                const exampleDir = path.dirname(examplePath);
                // Use the example directory as the working directory
                const serverInfo = await (0, serverManager_1.createServer)(examplePath, serverMode, context);
                if (serverInfo) {
                    // Open browser
                    vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
                    // Show confirmation
                    vscode.window.showInformationMessage(`Server started at ${serverInfo.url}`);
                    // Refresh the tree to show the new server
                    treeDataProvider.refresh();
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error launching example: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // New command - Check certificate status
    const checkCertificatesCommand = vscode.commands.registerCommand('integracionvsaframe.checkCertificates', async () => {
        const certStatus = (0, certificateManager_1.defaultCertificatesExist)(context);
        if (certStatus) {
            vscode.window.showInformationMessage('Default SSL certificates are present and ready to use for HTTPS servers.');
        }
        else {
            const result = await vscode.window.showWarningMessage('Default SSL certificates not found. HTTPS servers will not work properly without them.', 'Generate Certificates', 'Learn More');
            if (result === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Fundamentals#https'));
            }
            else if (result === 'Generate Certificates') {
                // This would link to a future certificate generation command
                vscode.window.showInformationMessage('Certificate generation will be implemented in a future update.');
            }
        }
    });
    // Command to stop all active servers
    const stopAllServersCommand = vscode.commands.registerCommand('integracionvsaframe.stopAllServers', async () => {
        try {
            const activeServers = (0, serverManager_1.getActiveServers)();
            if (activeServers.length === 0) {
                vscode.window.showInformationMessage('No active servers to stop');
                return;
            }
            // Ask for confirmation if multiple servers are running
            if (activeServers.length > 1) {
                const confirm = await vscode.window.showWarningMessage(`Are you sure you want to stop all ${activeServers.length} running servers?`, 'Yes', 'No');
                if (confirm !== 'Yes') {
                    return;
                }
            }
            // Stop each server one by one
            for (const server of activeServers) {
                (0, serverManager_1.stopServer)(server.id);
            }
            vscode.window.showInformationMessage(`Stopped ${activeServers.length} servers successfully`);
            // Refresh the view
            treeDataProvider.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error stopping servers: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // BabiaXR Configuration Commands
    // ----------------------------
    // Command to set background color
    const setBabiaBackgroundColorCommand = vscode.commands.registerCommand('integracionvsaframe.setBabiaBackgroundColor', async () => {
        try {
            const backgroundColor = await (0, colorPickerUtils_1.showColorPicker)('Select Background Color', context.globalState.get('babiaBackgroundColor') || '#112233');
            if (backgroundColor) {
                await context.globalState.update('babiaBackgroundColor', backgroundColor);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating background color: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command to set environment preset
    const setBabiaEnvironmentPresetCommand = vscode.commands.registerCommand('integracionvsaframe.setBabiaEnvironmentPreset', async () => {
        try {
            const environmentPreset = await vscode.window.showQuickPick(optionsCollector_1.ENVIRONMENT_PRESETS.map(preset => ({
                label: preset.value,
                description: preset.description
            })), {
                placeHolder: 'Select environment preset',
                matchOnDescription: true // Allow searching in the descriptions
            });
            if (environmentPreset) {
                await context.globalState.update('babiaEnvironmentPreset', environmentPreset.label);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating environment preset: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command to set ground color
    const setBabiaGroundColorCommand = vscode.commands.registerCommand('integracionvsaframe.setBabiaGroundColor', async () => {
        try {
            const groundColor = await (0, colorPickerUtils_1.showColorPicker)('Select Ground Color', context.globalState.get('babiaGroundColor') || '#445566');
            if (groundColor) {
                await context.globalState.update('babiaGroundColor', groundColor);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating ground color: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Command to set chart palette
    const setBabiaChartPaletteCommand = vscode.commands.registerCommand('integracionvsaframe.setBabiaChartPalette', async () => {
        try {
            const chartPalette = await vscode.window.showQuickPick(optionsCollector_1.COLOR_PALETTES.map(palette => ({
                label: palette.value,
                description: palette.description
            })), {
                placeHolder: 'Select chart color palette',
                matchOnDescription: true
            });
            if (chartPalette) {
                await context.globalState.update('babiaChartPalette', chartPalette.label);
                treeDataProvider.refresh();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error updating chart palette: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Register all commands
    context.subscriptions.push(
    // View commands
    refreshViewCommand, 
    // Server configuration commands
    changeServerModeCommand, startServerWithConfigCommand, startServerCommand, stopServerCommand, 
    // Server management commands
    serverOptionsCommand, serverStatusActionsCommand, 
    // BabiaXR commands
    createBabiaXRVisualizationCommand, launchBabiaXRExampleCommand, 
    // New commands
    checkCertificatesCommand, stopAllServersCommand, 
    // BabiaXR configuration commands
    setBabiaBackgroundColorCommand, setBabiaEnvironmentPresetCommand, setBabiaGroundColorCommand, setBabiaChartPaletteCommand);
}
/**
 * This function is executed when the extension is deactivated
 */
function deactivate() {
    (0, serverManager_1.stopServer)(); // Ensure all servers are stopped when extension is deactivated
}
//# sourceMappingURL=extension.js.map