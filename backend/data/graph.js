const graph = {
  nodes: [
    { id: "A" },
    { id: "B" },
    { id: "C" },
    { id: "D" }
  ],
  edges: [
    {
      id: "E1",
      from: "A",
      to: "B",
      load: 50,
      capacity: 100,
      overloadTime: 0,
      threshold: 3,
      status: "normal"
    },
    {
      id: "E2",
      from: "B",
      to: "C",
      load: 70,
      capacity: 80,
      overloadTime: 0,
      threshold: 3,
      status: "normal"
    },
    {
      id: "E3",
      from: "C",
      to: "D",
      load: 30,
      capacity: 60,
      overloadTime: 0,
      threshold: 3,
      status: "normal"
    },
    {
      id: "E4",
      from: "A",
      to: "D",
      load: 20,
      capacity: 50,
      overloadTime: 0,
      threshold: 3,
      status: "normal"
    }
  ]
};

module.exports = graph;