import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import {
	convertToToon,
	convertToJson,
	generateInputInstruction,
	generateOutputInstruction,
	isForbiddenKey,
	safeMerge,
	validateInputSize,
} from './converter';

export class ToonConverter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TOON Converter',
		name: 'toonConverter',
		icon: 'file:toon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] }}',
		description:
			'Convert between JSON and TOON (Token-Oriented Object Notation) — optimized format for LLM token efficiency',
		defaults: {
			name: 'TOON Converter',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		properties: [
			// ------ Operation ------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Convert to TOON',
						value: 'jsonToToon',
						description: 'Convert JSON data to TOON format (reduces LLM tokens by 30-60%)',
						action: 'Convert JSON to TOON',
					},
					{
						name: 'Convert to JSON',
						value: 'toonToJson',
						description: 'Parse TOON text back into JSON data',
						action: 'Convert TOON to JSON',
					},
				],
				default: 'jsonToToon',
			},

			// ------ JSON → TOON fields ------
			{
				displayName: 'Source',
				name: 'jsonSource',
				type: 'options',
				options: [
					{
						name: 'Input Item (JSON)',
						value: 'inputItem',
						description: 'Use the entire incoming JSON item',
					},
					{
						name: 'JSON Expression',
						value: 'expression',
						description: 'Provide a JSON value via an expression',
					},
					{
						name: 'JSON String',
						value: 'jsonString',
						description: 'Paste or type a raw JSON string',
					},
				],
				default: 'inputItem',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
					},
				},
				description: 'Where to read the JSON data from',
			},
			{
				displayName: 'JSON Field',
				name: 'jsonField',
				type: 'string',
				default: '',
				placeholder: 'e.g. data',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
						jsonSource: ['inputItem'],
					},
				},
				description:
					'Optional: specific field from the input item to convert. Leave empty to convert the entire item.',
			},
			{
				displayName: 'JSON Value',
				name: 'jsonExpression',
				type: 'json',
				default: '',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
						jsonSource: ['expression'],
					},
				},
				description: 'A JSON value (use expressions to reference other nodes)',
			},
			{
				displayName: 'JSON String',
				name: 'jsonString',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				default: '',
				placeholder: '{"name": "Ada", "age": 30}',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
						jsonSource: ['jsonString'],
					},
				},
				description: 'Raw JSON string to convert to TOON',
			},
			{
				displayName: 'Output Field',
				name: 'jsonToToonOutputField',
				type: 'string',
				default: 'toon',
				displayOptions: {
					show: {
						operation: ['jsonToToon'],
					},
				},
				description: 'Name of the output field that will contain the TOON string',
			},

			// ------ TOON → JSON fields ------
			{
				displayName: 'TOON Source',
				name: 'toonSource',
				type: 'options',
				options: [
					{
						name: 'Input Field',
						value: 'inputField',
						description: 'Read TOON text from a field in the input item',
					},
					{
						name: 'TOON String',
						value: 'toonString',
						description: 'Paste or type a raw TOON string',
					},
				],
				default: 'inputField',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
					},
				},
				description: 'Where to read the TOON text from',
			},
			{
				displayName: 'Input Field',
				name: 'toonField',
				type: 'string',
				default: 'toon',
				placeholder: 'e.g. toon',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
						toonSource: ['inputField'],
					},
				},
				description: 'Name of the input field containing the TOON string',
			},
			{
				displayName: 'TOON String',
				name: 'toonText',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				default: '',
				placeholder: 'user:\n  id: 1\n  name: Ada',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
						toonSource: ['toonString'],
					},
				},
				description: 'Raw TOON string to convert to JSON',
			},
			{
				displayName: 'Output Mode',
				name: 'toonToJsonOutputMode',
				type: 'options',
				options: [
					{
						name: 'Merge Into Item',
						value: 'merge',
						description: 'Merge the parsed JSON object into the output item',
					},
					{
						name: 'Put in Field',
						value: 'field',
						description: 'Store the parsed result in a specific field',
					},
				],
				default: 'merge',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
					},
				},
				description: 'How to output the parsed JSON',
			},
			{
				displayName: 'Output Field',
				name: 'toonToJsonOutputField',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						operation: ['toonToJson'],
						toonToJsonOutputMode: ['field'],
					},
				},
				description: 'Name of the output field that will contain the parsed JSON',
			},

			// ------ Options ------
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Keep Source Fields',
						name: 'keepSource',
						type: 'boolean',
						default: true,
						description:
							'Whether to keep the original input fields in the output item alongside the conversion result',
					},
					{
						displayName: 'Auto-Parse Stringified JSON',
						name: 'autoParseJson',
						type: 'boolean',
						default: false,
						description:
							'Whether to detect and parse JSON strings inside fields before converting to TOON. ' +
							'This lets TOON compress the inner structure instead of treating it as an opaque string. ' +
							'Only applies to "Convert to TOON".',
					},
					{
						displayName: 'Include LLM Instructions',
						name: 'includeLlmInstructions',
						type: 'boolean',
						default: false,
						description:
							'Whether to include ready-to-use LLM instruction prompts in the output. ' +
							'Adds "llmInputInstruction" (explains the TOON data format to the LLM) and ' +
							'"llmOutputInstruction" (tells the LLM to respond in TOON format).',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as {
					keepSource?: boolean;
					autoParseJson?: boolean;
					includeLlmInstructions?: boolean;
				};
				const keepSource = options.keepSource !== false;

				if (operation === 'jsonToToon') {
					const outputField = this.getNodeParameter('jsonToToonOutputField', i) as string;

					if (isForbiddenKey(outputField)) {
						throw new NodeOperationError(
							this.getNode(),
							`Output field name "${outputField}" is not allowed (reserved key)`,
							{ itemIndex: i },
						);
					}

					const source = this.getNodeParameter('jsonSource', i) as string;

					let data: unknown;

					if (source === 'inputItem') {
						const field = this.getNodeParameter('jsonField', i, '') as string;
						if (field) {
							data = items[i].json[field];
							if (data === undefined) {
								throw new NodeOperationError(
									this.getNode(),
									`Field "${field}" not found in input item`,
									{ itemIndex: i },
								);
							}
						} else {
							data = items[i].json;
						}
					} else if (source === 'expression') {
						const raw = this.getNodeParameter('jsonExpression', i) as string;
						if (typeof raw === 'string') {
							validateInputSize(raw, 'JSON expression');
							data = JSON.parse(raw);
						} else {
							data = raw;
						}
					} else {
						const raw = this.getNodeParameter('jsonString', i) as string;
						validateInputSize(raw, 'JSON string');
						data = JSON.parse(raw);
					}

					const toonString = convertToToon(data, options.autoParseJson);

					const json: IDataObject = keepSource ? { ...items[i].json } : {};
					json[outputField] = toonString;

					if (options.includeLlmInstructions) {
						json.llmInputInstruction = generateInputInstruction(toonString);
						json.llmOutputInstruction = generateOutputInstruction();
					}

					returnData.push({ json, pairedItem: { item: i } });
				} else {
					// toonToJson
					const toonSource = this.getNodeParameter('toonSource', i) as string;
					let toonText: string;

					if (toonSource === 'inputField') {
						const field = this.getNodeParameter('toonField', i) as string;
						const value = items[i].json[field];
						if (value === undefined) {
							throw new NodeOperationError(
								this.getNode(),
								`Field "${field}" not found in input item`,
								{ itemIndex: i },
							);
						}
						if (typeof value !== 'string') {
							throw new NodeOperationError(
								this.getNode(),
								`Field "${field}" must be a string containing TOON text, got ${typeof value}`,
								{ itemIndex: i },
							);
						}
						toonText = value;
					} else {
						toonText = this.getNodeParameter('toonText', i) as string;
					}

					const parsed = convertToJson(toonText);
					const outputMode = this.getNodeParameter('toonToJsonOutputMode', i) as string;

					let json: IDataObject;

					if (outputMode === 'merge') {
						json = keepSource ? { ...items[i].json } : {};
						if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
							safeMerge(json, parsed as Record<string, unknown>);
						} else {
							json.data = parsed as IDataObject;
						}
					} else {
						const outputField = this.getNodeParameter('toonToJsonOutputField', i) as string;

						if (isForbiddenKey(outputField)) {
							throw new NodeOperationError(
								this.getNode(),
								`Output field name "${outputField}" is not allowed (reserved key)`,
								{ itemIndex: i },
							);
						}

						json = keepSource ? { ...items[i].json } : {};
						json[outputField] = parsed as IDataObject;
					}

					returnData.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex: i,
					});
				}
			}
		}

		return [returnData];
	}
}
