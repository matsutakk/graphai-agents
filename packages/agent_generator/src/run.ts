//仕様と必要な情報（npmやデータ）をテキストで用意する
// generatorを呼び出してスケルトンを作る
// agentの中身を実装する
// unit testを動かす -> 失敗したら結果やエラーを元に3を再実装
// できたら、documentもつくる
import * as path from "node:path";

import { GraphAI } from "graphai";
import { openAIAgent } from "@graphai/openai_agent";
import { copyAgent, nestedAgent, stringCaseVariantsAgent } from "@graphai/vanilla";
import { fileReadAgent, fileWriteAgent, pathUtilsAgent } from "@graphai/vanilla_node_agents";
import { runShellAgent } from "@graphai/shell_utilty_agent";

import "dotenv/config";

const tools = [
  {
    type: "function",
    function: {
      name: "generate_package",
      description: "generate agent skelton",
      parameters: {
        type: "object",
        properties: {
          agentName: {
            type: "string",
            description: "The agent name. Separate words with spaces.",
          },
          description: {
            type: "string",
            description: "Explain what the agent does",
          },
          category: {
            type: "string",
            description: "category of the agent.",
          },
          npmPackages: {
            type: "array",
            description: "list of npm package if you need.",
            items: {
              type: "string",
            },
          },
        },
        required: ["agentName", "description", "category"],
      },
    },
  },
];

const main = async () => {
  const graphData = {
    version: 0.5,
    nodes: {
      packageBaseDir: {
        value: "",
      },
      templateBaseDir: {
        value: "",
      },
      specPrompt: {
        value: "",
      },
      implementPrompt: {
        value: "",
      },
      errorPrompt: {
        value: "",
      },
      specFileReader: {
        agent: "fileReadAgent",
        inputs: {
          array: ["template/spec.md", "template/spec_base.md"],
        },
        params: {
          baseDir: ":templateBaseDir",
          outputType: "text",
        },
        console: { after: true },
        isResult: true,
      },
      specFile: {
        agent: "copyAgent",
        inputs: { data: "${:specFileReader.array.$0}\n\n${:specFileReader.array.$1}" },
        isResult: true,
      },
      specLLM: {
        agent: "openAIAgent",
        inputs: {
          prompt: "${:specPrompt}\n\n ${:specFile.data}",
          tools,
        },
        console: { after: true },
      },
      packageInfo: {
        agent: "stringCaseVariantsAgent",
        params: {
          suffix: "agent",
        },
        inputs: {
          text: ":specLLM.tool.arguments.agentName",
        },
        isResult: true,
      },
      createSkeleton: {
        agent: "runShellAgent",
        inputs: {
          command:
            "npm create graphai-agent@latest  -- -c  --agentName ${:packageInfo.kebabCase} --description ${:specLLM.tool.arguments.description} --author me --license MIT --category ${:specLLM.tool.arguments.category} --outdir ${:packageBaseDir}",
          baseDir: ":packageBaseDir",
        },
      },
      srcFile: {
        agent: "pathUtilsAgent",
        params: { method: "join" },
        inputs: { dirs: [":packageInfo.kebabCase", "src", "${:packageInfo.snakeCase}.ts"] },
      },
      programmer: {
        agent: "nestedAgent",
        isResult: true,
        inputs: {
          waiting: ":createSkeleton",
          packageInfo: ":packageInfo",
          srcFile: ":srcFile",
          specFile: ":specFile",
          packageBaseDir: ":packageBaseDir",
          implementPrompt: ":implementPrompt",
          errorPrompt: ":errorPrompt",
        },
        graph: {
          loop: {
            while: ":yarnTest.error",
          },
          nodes: {
            error: {
              value: "",
              update: ":yarnTest.error",
            },
            sourceFile: {
              agent: "fileReadAgent",
              inputs: {
                file: ":srcFile.path",
              },
              params: {
                baseDir: ":packageBaseDir",
                outputType: "text",
              },
            },
            llm: {
              agent: "openAIAgent",
              inputs: {
                system: ":specFile.data",
                prompt: "${:implementPrompt}\n\n ${:sourceFile.data}\n\n\n${:errorPrompt}\n\n${:error}",
              },
              console: { before: true },
            },
            res: {
              agent: "copyAgent",
              inputs: {
                text: ":llm.text.codeBlock()",
              },
              isResult: true,
            },
            writeFile: {
              agent: "fileWriteAgent",
              inputs: {
                file: ":srcFile.path",
                text: ":llm.text.codeBlock()",
              },
              params: {
                baseDir: ":packageBaseDir",
                outputType: "text",
              },
            },
            yarnInstall: {
              agent: "runShellAgent",
              params: {},
              inputs: {
                command: "yarn install",
                waiting: ":writeFile.result",
                dirs: [":packageBaseDir", ":packageInfo.kebabCase"],
              },
            },
            yarnTest: {
              agent: "runShellAgent",
              params: {},
              inputs: {
                command: "yarn run test && yarn run eslint",
                waiting: ":yarnInstall",
                dirs: [":packageBaseDir", ":packageInfo.kebabCase"],
              },
            },
          },
        },
      },
      final: {
        agent: "runShellAgent",
        params: {},
        inputs: {
          command: "yarn run build && yarn run doc",
          dirs: [":packageBaseDir", ":packageInfo.kebabCase"],
          waiting: ":programmer",
        },
      },
      writeSpec: {
        agent: "fileWriteAgent",
        inputs: {
          file: "spec.txt",
          waiting: ":programmer",
          text: ":specFileReader.array.$0",
        },
        params: {
          baseDir: "${:packageBaseDir}/${:packageInfo.kebabCase}",
          outputType: "text",
        },
      },
    },
  };
  const graph = new GraphAI(graphData, {
    openAIAgent,
    copyAgent,
    fileReadAgent,
    fileWriteAgent,
    nestedAgent,
    runShellAgent,
    stringCaseVariantsAgent,
    pathUtilsAgent,
  });

  graph.injectValue("templateBaseDir", path.resolve(__dirname, ".."));
  graph.injectValue("packageBaseDir", path.resolve(__dirname, "..", "tmp"));
  graph.injectValue(
    "specPrompt",
    "以下の仕様を元に必要な情報を教えて下さい。結果はgenerate_packageで返してください。npmパッケージが必要な場合はそれも一覧で返してください。",
  );
  graph.injectValue("implementPrompt", "以下のソースを仕様に従って変更して");
  graph.injectValue("errorPrompt", "エラー情報");
  const result = (await graph.run()) as any;
  console.log(result);
};

main();
