import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, remove, push } from "firebase/database";
import { getUser } from "../auth";
import "../styles/product2.css";

const Product2 = () => {
  const [product, setProduct] = useState({
    category: "",
    item: "",
    quantity: "",
    price: "",
    cost: "",
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
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  // Save Product with auto profit calculation
  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      const price = parseFloat(product.price) || 0;
      const cost = parseFloat(product.cost) || 0;
      const quantity = parseFloat(product.quantity) || 0;

      const costPerQty = quantity > 0 ? cost / quantity : 0;
      const profitPerQty = price - costPerQty;
      const totalProfit = profitPerQty * quantity;

      const newProduct = {
        ...product,
        profitPerQty,
        totalProfit,
      };

      const productRef = ref(db, "tools");
      await push(productRef, newProduct);

      alert("Product saved successfully!");

      setProduct({
        category: "",
        item: "",
        quantity: "",
        price: "",
        cost: "",
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
      profitPerQty: p.profitPerQty ?? 0,
      totalProfit: p.totalProfit ?? 0,
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
        profitPerQty: Number(editData.profitPerQty),
        totalProfit: Number(editData.totalProfit),
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

            <div className="form-group">
              <label>Cost</label>
              <input
                type="number"
                name="cost"
                placeholder="0"
                value={product.cost}
                onChange={handleChange}
                required
                min="0"
              />
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

                      <td>₱{p.cost}</td>

                      <td>
                        Per Qty: ₱{Number(p.profitPerQty).toFixed(2)} <br />
                        Total: ₱{Number(p.totalProfit).toFixed(2)}
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
