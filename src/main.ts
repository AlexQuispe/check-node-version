import { exec, ExecException } from "child_process";
import semver from "semver";
import path from "path";

const APP_LIST = ["node", "npm", "yarn"];
const PROJECT_PATH = process.cwd();

const cmd = (command: string, executePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd: executePath },
      (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) reject(stderr);
        if (!error) resolve(stdout);
      }
    );
  });
};

async function getPackageJson() {
  try {
    const packageJsonPath = path.resolve(PROJECT_PATH, "package.json");
    const packageJson = await import(packageJsonPath);
    return packageJson;
  } catch (e) {
    return {};
  }
}

async function versionValid(appName: string): Promise<boolean> {
  const currentVersion = (await cmd(`${appName} --version`, PROJECT_PATH))
    .trim()
    .replace("v", "");

  const packageJson = await getPackageJson();
  const requiredVersion =
    packageJson.engines?.[appName] || packageJson.volta?.[appName];

  const isValid =
    !requiredVersion || semver.satisfies(currentVersion, requiredVersion);

  const result = isValid
    ? `\x1b[32m${appName}: ${currentVersion}\x1b[0m\n`
    : `\x1b[31m${appName}: ${currentVersion}\x1b[0m \x1b[33m(versión requerida: ${requiredVersion})\x1b[0m\n`;

  process.stdout.write(result);
  return isValid;
}

async function getApps(): Promise<string[]> {
  const packageJson = await getPackageJson();
  const appSet = new Set<string>();

  if (packageJson.engines)
    Object.keys(packageJson.engines).map((key) => appSet.add(key));

  if (packageJson.volta)
    Object.keys(packageJson.volta).map((key) => appSet.add(key));

  const appSelectedList = Array.from(appSet);
  return APP_LIST.filter((app) => appSelectedList.includes(app));
}

async function init() {
  // SHOW APP VERSION
  if (
    process.argv.join(" ").includes(" --version") ||
    process.argv.join(" ").includes(" -v")
  ) {
    const version = (await import(`${__dirname}/../package.json`)).version;
    return process.stdout.write(`${version}\n`);
  }

  // EXECUTE APP
  const appList = await getApps();

  if (appList.length === 0) {
    const msg = `\x1b[32m\n¡Ups! ¿estamos dentro del proyecto?\x1b[0m

Si es asi, puedes especificar la versión de \x1b[36mnode\x1b[0m, \x1b[36mnpm\x1b[0m y/o \x1b[36myarn\x1b[0m dentro del archivo \x1b[36mpackage.json\x1b[0m

Ejemplo:

\x1b[36m{
  "name": "my-project",
  "version": "1.0.0",
  "engines": {
    "node": "^16",
    "npm": "^8"
  }
}\x1b[0m\n\n`;
    return process.stdout.write(msg);
  }

  let isValid = true;

  const packageJson = await getPackageJson();
  process.stdout.write(
    `\x1b[94m${packageJson.name}: ${packageJson.version}\x1b[0m\n`
  );

  for (const appItem of appList) {
    if (!(await versionValid(appItem))) isValid = false;
  }

  if (!isValid) {
    process.stdout.write(`\n\x1b[33m¡Ups! no podemos continuar.\n\nVerifica que la versión requerida se encuentre activada (Ej.: node --version) e inténtalo nuevamente.\x1b[0m\n\n`);
    process.exit(1);
  }

  process.stdout.write(`\n\x1b[94mParece que todo está en orden, continuemos...\x1b[0m\n\n`);
}

init().catch((e) => {
  console.error(e);
  process.exit(1);
});
