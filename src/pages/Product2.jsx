import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, remove, push } from "firebase/database";
import { getUser } from "../auth";
import "../styles/product2.css";

// Add styles for stock status
const styles = `
  .low-stock {
    background-color: #fff3cd;
    color: #856404;
    font-weight: 500;
  }
  .in-stock {
    background-color: #d4edda;
    color: #155724;
  }
  .low-stock-badge {
    display: inline-block;
    background-color: #ffc107;
    color: #000;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: bold;
    margin-top: 4px;
  }
`;

// Add the styles to the document head
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

const Product2 = () => {
  const [product, setProduct] = useState({
    category: "",
    item: "",
    quantity: "",
    price: "",
    cost: "",
    costPerQty: "",
    lowStockThreshold: "5", // Default low stock threshold of 5
  });

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const currentUser = getUser();
  const isStaff = currentUser && currentUser.username === "staff@inventory.com";
  const [editData, setEditData] = useState({});

  // Handle form input
  const handleChange = (e) => {
    const { name, value } = e.target;

    setProduct((prev) => {
      const updated = { ...prev, [name]: value };

      const quantity = parseFloat(updated.quantity) || 0;
      const totalCost = parseFloat(updated.cost) || 0;
      const perQty = parseFloat(updated.costPerQty) || 0;

      // If user edited total cost, compute cost per qty
      if (name === "cost") {
        updated.costPerQty = quantity > 0 ? (totalCost / quantity).toFixed(2) : "";
      }

      // If user edited cost per qty, compute total cost
      if (name === "costPerQty") {
        updated.cost = !isNaN(perQty) ? Number((perQty * quantity).toFixed(2)) : "";
      }

      // If quantity changed, recalc whichever cost field is present
      if (name === "quantity") {
        if (!isNaN(perQty) && perQty > 0) {
          updated.cost = Number((perQty * quantity).toFixed(2));
        } else if (!isNaN(totalCost) && totalCost > 0) {
          updated.costPerQty = quantity > 0 ? (totalCost / quantity).toFixed(2) : "";
        }
      }

      return updated;
    });
  };

  // Save Product with auto profit calculation
  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      const price = parseFloat(product.price) || 0;
      const cost = parseFloat(product.cost) || 0;
      const quantity = parseFloat(product.quantity) || 0;
      const costPerQtyInput = parseFloat(product.costPerQty) || 0;
      const lowStockThreshold = parseInt(product.lowStockThreshold) || 5;
      const costPerQty = costPerQtyInput > 0 ? costPerQtyInput : (quantity > 0 ? cost / quantity : 0);
      const profitPerQty = price - costPerQty;
      const totalProfit = profitPerQty * quantity;

      const newProduct = {
        ...product,
        costPerQty,
        profitPerQty,
        totalProfit,
        lowStockThreshold,
      };

      const productRef = ref(db, "tools");
      await push(productRef, newProduct);

      alert("Product saved successfully!");

      setProduct({
        category: "",
        item: "",
        quantity: "",
        price: "",
        cost: product.cost,
        costPerQty: product.costPerQty,
        lowStockThreshold: product.lowStockThreshold, // Keep the threshold for the next entry
      });
    } catch (error) {
      console.error("Error adding product: ", error);
    }
  };

  // Fetch products
  useEffect(() => {
    const productRef = ref(db, "tools");
    onValue(productRef, (snapshot) => {
      const data = snapshot.val();
      const loaded = data
        ? Object.keys(data).map((id) => ({ id, ...data[id] }))
        : [];
      setProducts(loaded);
    });
  }, []);

  // Start editing row
  const startEdit = (p) => {
    setEditingId(p.id);
    setEditData({
      category: p.category || "",
      item: p.item || "",
      quantity: p.quantity || 0,
      price: p.price || 0,
      cost: p.cost || 0,
      costPerQty: p.costPerQty ?? 0,
      profitPerQty: p.profitPerQty ?? 0,
      totalProfit: p.totalProfit ?? 0,
      lowStockThreshold: p.lowStockThreshold ?? 5,
    });
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  // Handle edit change
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  // Save edited values
  const saveEdit = async (id) => {
    try {
      await update(ref(db, `tools/${id}`), {
        ...editData,
        quantity: Number(editData.quantity),
        price: Number(editData.price),
        cost: Number(editData.cost),
        costPerQty: Number(editData.costPerQty || 0),
        profitPerQty: Number(editData.profitPerQty),
        totalProfit: Number(editData.totalProfit),
        lowStockThreshold: Number(editData.lowStockThreshold || 5),
      });

      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error("Error saving edit:", error);
    }
  };

  // Delete product
  const deleteProduct = async (id) => {
    const ok = window.confirm("Delete this product?");
    if (!ok) return;

    try {
      await remove(ref(db, `tools/${id}`));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  // Search filter
  const filteredProducts = products.filter(
    (p) =>
      p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.item?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const groupedByCategory = filteredProducts.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {});

  return (
    <div className="product2-container">
      {/* Header */}
      <div className="product2-header">
        <h2>Tools Management</h2>
        <p>Add and manage tools and equipment in your inventory</p>
      </div>

      {/* Form Section */}
      <div className="product2-form-section">
        <h3>Add New Tool Product</h3>

        <form onSubmit={saveProduct} className="product2-form">
          <div className="form-row">
            <div className="form-group">
              <label>Category Name</label>
              <input
                type="text"
                name="category"
                placeholder="e.g., Brushes, Rollers, Safety"
                value={product.category}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Item</label>
              <input
                type="text"
                name="item"
                placeholder="e.g., Round Brush #8"
                value={product.item}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                name="quantity"
                placeholder="0"
                value={product.quantity}
                onChange={handleChange}
                required
                min="0"
              />
              <div style={{ marginTop: '5px' }}>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Low Stock Alert At:</label>
                <input
                  type="number"
                  name="lowStockThreshold"
                  placeholder="5"
                  value={product.lowStockThreshold}
                  onChange={handleChange}
                  required
                  min="1"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Price</label>
              <input
                type="number"
                name="price"
                placeholder="0"
                value={product.price}
                onChange={handleChange}
                required
                min="0"
              />
            </div>

            <div className="form-row-inline">
              <div className="form-group" style={{ flex: 1.5 }}>
                <label>Cost per Qty</label>
                <input
                  type="number"
                  name="costPerQty"
                  placeholder="0"
                  value={product.costPerQty}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Total Cost</label>
                <input
                  type="number"
                  name="cost"
                  placeholder="0"
                  value={product.cost}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Save Tool Product
          </button>
        </form>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <h3>Tool Products List</h3>
        <input
          type="text"
          placeholder="Search by category or item name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Product List by Category */}
      {Object.keys(groupedByCategory).length === 0 ? (
        <div className="empty-state">
          <p>No tools found. Try adjusting your search or add a new tool product.</p>
        </div>
      ) : (
        Object.keys(groupedByCategory).map((category) => (
          <div key={category} className="category-section">
            <div className="category-header">{category}</div>

            <table className="tools-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Profit</th>
                  <th>Stock Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {groupedByCategory[category].map((p) => {
                  const isSold = Number(p.quantity) === 0;

                  // EDIT MODE
                  if (editingId === p.id) {
                    return (
                      <tr
                        key={p.id}
                        className={`editing-row ${isSold ? "row-sold" : ""}`}
                      >
                        <td>
                          <input
                            name="item"
                            value={editData.item}
                            onChange={handleEditChange}
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            name="quantity"
                            value={editData.quantity}
                            onChange={handleEditChange}
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            name="price"
                            value={editData.price}
                            onChange={handleEditChange}
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            name="cost"
                            value={editData.cost}
                            onChange={handleEditChange}
                          />
                          <div style={{ marginTop: 6 }}>
                            <label style={{ fontSize: 12, display: "block" }}>Per Qty:</label>
                            <input
                              type="number"
                              name="costPerQty"
                              value={editData.costPerQty}
                              onChange={handleEditChange}
                              step="0.01"
                            />
                          </div>
                        </td>

                        <td>
                          <div className="profit-edit-section">
                            <div className="profit-edit-row">
                              <label>Per Qty:</label>
                              <input
                                type="number"
                                name="profitPerQty"
                                value={editData.profitPerQty}
                                onChange={handleEditChange}
                              />
                            </div>
                            <div className="profit-edit-row">
                              <label>Total:</label>
                              <input
                                type="number"
                                name="totalProfit"
                                value={editData.totalProfit}
                                onChange={handleEditChange}
                              />
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => saveEdit(p.id)}
                              className="btn-save"
                            >
                              Save
                            </button>
                            <button onClick={cancelEdit} className="btn-cancel">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // NORMAL ROW
                  return (
                    <tr
                      key={p.id}
                      className={isSold ? "row-sold" : ""}
                    >
                      <td>
                        {p.item}
                        {isSold && (
                          <span className="sold-badge">OUT OF STOCK</span>
                        )}
                      </td>

                      <td>{p.quantity}</td>

                      <td>₱{p.price}</td>

                      <td>
                        ₱{p.cost} {p.costPerQty !== undefined && (
                          <span style={{ fontSize: 12 }}> (₱{Number(p.costPerQty).toFixed(2)} per qty)</span>
                        )}
                      </td>



                      <td>
                        Per Qty: ₱{Number(p.profitPerQty).toFixed(2)} <br />
                        Total: ₱{Number(p.totalProfit).toFixed(2)}
                      </td>

                      <td className={Number(p.quantity) <= (p.lowStockThreshold || 5) ? 'low-stock' : 'in-stock'}>
                        <div>Current: {p.quantity} qty</div>
                        <div>Alert at: {p.lowStockThreshold || 5} qty</div>
                        {Number(p.quantity) <= (p.lowStockThreshold || 5) && (
                          <div className="low-stock-badge">LOW STOCK</div>
                        )}
                      </td>

                      <td>
                        <div className="action-buttons">
                          {!isStaff && (
                            <button
                              onClick={() => startEdit(p)}
                              className="btn-edit"
                            >
                              Edit
                            </button>
                          )}
                          {!isStaff && (
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="btn-delete"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default Product2;
