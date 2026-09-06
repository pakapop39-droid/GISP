declare module "read-excel-file/node" {
  export default function readXlsxFile(input: Buffer): Promise<unknown[][]>;
}
