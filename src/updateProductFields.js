import { db } from "../firebase";
import { ref, onValue, update } from "firebase/database";

const updateDatabase = () => {
  // Update PAINT products
  const paintRef = ref(db, "products");
  onValue(paintRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    Object.keys(data).forEach((id) => {
      const item = data[id];

      update(ref(db, `products/${id}`), {
        totalCost: parseFloat(item.cost) || 0,
        totalProfit: parseFloat(item.profit) || 0,
      });
    });
  });

  // Update TOOL products
  const toolRef = ref(db, "tools");
  onValue(toolRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    Object.keys(data).forEach((id) => {
      const item = data[id];

      update(ref(db, `tools/${id}`), {
        totalCost: parseFloat(item.cost) || 0,
        totalProfit: parseFloat(item.profit) || 0,
      });
    });
  });

  alert("Database updated with totalCost and totalProfit!");
};

export default updateDatabase;
