// const data = [
//   { hello: { status: "Verified" } },
//   { hello1: { status: "Verified" } },
//   { hello2: { status: "UnVerified" } },
//   { hello3: { status: "Verified" } },
//   { hello5: { status: "UnVerified" } },
// ];

// const result = Object.values(
//   data.reduce((acc, obj) => {
//     const [key] = Object.keys(obj);
//     const status = obj[key].status;
//     acc[status] = acc[status] || [status];
//     acc[status].push(obj);
//     return acc;
//   }, {})
// );

// console.log(JSON.stringify(result, null, 2));

const data = [
  { hello: { status: "Verified" } },
  { hello: { status: "Verified" } },
  { hello: { status: "UnVerified" } },
  { hello: { status: "Verified" } },
  { hello: { status: "UnVerified" } },
];

// const result = Object.values(
//   data.reduce(
//     (a, o) =>
//       (([k], s = o[k].status) => ((a[s] ??= [s]).push(o), a))(Object.keys(o)),
//     {}
//   )
// );

const [verified, UnVerified] = data.reduce(
  ([ver, unver], item) => {
    if (item.hello.status === "Verified") {
      ver.push(item);
    } else {
      unver.push(item);
    }
    return [ver, unver];
  },
  [[], []]
);

console.log("✌️UnVerified --->", UnVerified);
console.log("✌️verified --->", verified);
