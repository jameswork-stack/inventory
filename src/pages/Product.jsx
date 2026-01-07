import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, remove, push } from "firebase/database";
import { getUser } from "../auth";
import "../styles/product.css";

// Add some styles for the stock status
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
  .sold {
    background-color: #f8d7da;
    color: #721c24;
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


const Product = () => {
  const [product, setProduct] = useState({
    brand: "",
    item: "",
    literValue: "",
    literUnit: "L",
    price: "",
    priceUnit: "perL",
    cost: "",
    costPerLiter: "",
    lowStockThreshold: "", // New field for low stock threshold
  });

  const [products, setProducts] = useState([]); // For listing products
  const [search, setSearch] = useState(""); // Search bar

  // Editing state (per-row)
  const [editingId, setEditingId] = useState(null);
  const currentUser = getUser();
  const isStaff = currentUser && currentUser.username === "staff@inventory.com";
  const [editData, setEditData] = useState({});

  // Fetch products from Firebase
  useEffect(() => {
    const productRef = ref(db, "products");
    onValue(productRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedProducts = Object.keys(data).map((id) => ({ id, ...data[id] }));
      setProducts(loadedProducts);
    });
  }, []);

  // Handle form input (Add)
  const handleChange = (e) => {
    const { name, value } = e.target;

    setProduct((prev) => {
      const updated = { ...prev, [name]: value };

      // parse numeric values for calculations
      const literValueRaw = parseFloat(updated.literValue) || 0;
      const totalLiters = updated.literUnit === "mL" ? literValueRaw / 1000 : literValueRaw;
      const totalCost = parseFloat(updated.cost) || 0;
      const perL = parseFloat(updated.costPerLiter) || 0;

      // If user edited total cost, compute cost per liter
      if (name === "cost") {
        updated.costPerLiter = totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : "";
      }

      // If user edited cost per liter, compute total cost
      if (name === "costPerLiter") {
        updated.cost = !isNaN(perL) ? Number((perL * totalLiters).toFixed(2)) : "";
      }

      // If quantity changed, recalc whichever cost field is present
      if (name === "literValue" || name === "literUnit") {
        if (!isNaN(perL) && perL > 0) {
          updated.cost = Number((perL * totalLiters).toFixed(2));
        } else if (!isNaN(totalCost) && totalCost > 0) {
          updated.costPerLiter = totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : "";
        }
      }

      return updated;
    });
  };

  // Save new product (unchanged behavior)
  const saveProduct = async (e) => {
    e.preventDefault();

    try {
      const literValueRaw = parseFloat(product.literValue) || 0;
      const priceInput = parseFloat(product.price) || 0;
      const totalCost = parseFloat(product.cost) || 0;
      const costPerLiterInput = parseFloat(product.costPerLiter) || 0;
      const lowStockThreshold = parseFloat(product.lowStockThreshold) || 0;

      // Convert amount to liters
      const totalLiters = product.literUnit === "mL" ? literValueRaw / 1000 : literValueRaw;

      // Convert input price to per liter
      const pricePerLiter = product.priceUnit === "permL" ? priceInput * 1000 : priceInput;

      // Use provided costPerLiter if given, otherwise compute from total cost
      const costPerLiter = costPerLiterInput > 0 ? costPerLiterInput : (totalLiters > 0 ? totalCost / totalLiters : 0);

      // Profit per liter & total
      const profitPerLiter = pricePerLiter - costPerLiter;
      const totalProfit = profitPerLiter * totalLiters;

      const newProduct = {
        ...product,
        literValue: literValueRaw,
        totalLiters,
        pricePerLiter,
        costPerLiter,
        profitPerLiter,
        totalProfit,
        lowStockThreshold,
      };

      const productRef = ref(db, "products");
      await push(productRef, newProduct);

      alert("Product saved successfully!");

      // Reset form
      // Keep total cost and cost per liter so user can add similar items quickly
      setProduct({
        brand: "",
        item: "",
        literValue: "",
        literUnit: "L",
        price: "",
        priceUnit: "perL",
        cost: product.cost,
        costPerLiter: product.costPerLiter,
        lowStockThreshold: product.lowStockThreshold,
      });
    } catch (error) {
      console.error("Error adding product: ", error);
    }
  };

  // Start editing a row
  const startEdit = (p) => {
    setEditingId(p.id);

    // Initialize editData with existing fields (keep safety defaults)
    setEditData({
      brand: p.brand || "",
      item: p.item || "",
      literValue: p.literValue ?? "", // keep original (could be 0)
      literUnit: p.literUnit || "L",
      price: p.price ?? "",
      priceUnit: p.priceUnit || "perL",
      cost: p.cost ?? "",
      // allow manual override of profitPerLiter and totalProfit
      profitPerLiter: p.profitPerLiter ?? p.profitPerL ?? 0,
      totalProfit: p.totalProfit ?? 0,
      lowStockThreshold: p.lowStockThreshold ?? 0,
    });
  };

  // Handle inline edit inputs
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  // Save edited row to Firebase (user requested manual override allowed)
  const saveEdit = async (id) => {
    try {
      // Prepare sanitized values (convert numeric fields)
      const updates = {
        brand: editData.brand,
        item: editData.item,
        literValue: editData.literValue === "" ? 0 : Number(editData.literValue),
        literUnit: editData.literUnit,
        price: editData.price === "" ? 0 : Number(editData.price),
        priceUnit: editData.priceUnit,
        cost: editData.cost === "" ? 0 : Number(editData.cost),
        // Allow direct manual edits of these profit fields (don't auto-recalc)
        profitPerLiter:
          editData.profitPerLiter === "" ? 0 : Number(editData.profitPerLiter),
        totalProfit: editData.totalProfit === "" ? 0 : Number(editData.totalProfit),
        lowStockThreshold: editData.lowStockThreshold === "" ? 0 : Number(editData.lowStockThreshold),
      };

      await update(ref(db, `products/${id}`), updates);

      // clear editing state
      setEditingId(null);
      setEditData({});
    } catch (err) {
      console.error("Error saving edit: ", err);
    }
  };

  // Filter & group by brand
  const filteredProducts = products
    .filter(
      (p) =>
        p.brand?.toLowerCase().includes(search.toLowerCase()) ||
        p.item?.toLowerCase().includes(search.toLowerCase())
    )
    .reduce((acc, curr) => {
      const brand = curr.brand || "Unbranded";
      if (!acc[brand]) acc[brand] = [];
      acc[brand].push(curr);
      return acc;
    }, {});

  // Sort inside each brand: available first -> SOLD last
  Object.keys(filteredProducts).forEach((brand) => {
    filteredProducts[brand].sort((a, b) => {
      const quantityA = a.literUnit === "mL" ? parseFloat(a.literValue) / 1000 : parseFloat(a.literValue);
      const quantityB = b.literUnit === "mL" ? parseFloat(b.literValue) / 1000 : parseFloat(b.literValue);
      const isSoldA = quantityA <= 0;
      const isSoldB = quantityB <= 0;
      if (isSoldA === isSoldB) return 0;
      return isSoldA ? 1 : -1;
    });
  });

  const deleteProduct = async (id) => {
  const ok = window.confirm("Are you sure you want to delete this product?");
  if (!ok) return;

  try {
    await remove(ref(db, `products/${id}`));
  } catch (err) {
    console.error("Error deleting product:", err);
  }
};


  return (
    <div className="product-container">
      {/* Header */}
      <div className="product-header">
        <h2>Product Management</h2>
        <p>Add and manage paint products in your inventory</p>
      </div>

      {/* Form Section */}
      <div className="product-form-section">
        <h3>Add New Product</h3>

        <form onSubmit={saveProduct} className="product-form">
          <div className="form-row">
            <div className="form-group">
              <label>Brand Name</label>
              <input
                type="text"
                name="brand"
                placeholder="e.g., Boysen, Nippon Paint"
                value={product.brand}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Item</label>
              <input
                type="text"
                name="item"
                placeholder="e.g., Gloss Premium White"
                value={product.item}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>Quantity</label>
              <input
                type="number"
                name="literValue"
                placeholder="0"
                value={product.literValue}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select name="literUnit" value={product.literUnit} onChange={handleChange}>
                <option value="L">Liter</option>
                <option value="mL">Milliliter</option>
              </select>
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-group" style={{ flex: 1.5 }}>
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
              <label>Price Unit</label>
              <select name="priceUnit" value={product.priceUnit} onChange={handleChange}>
                <option value="perL">₱ per Liter</option>
                <option value="permL">₱ per Milliliter</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-row-inline">
              <div className="form-group" style={{ flex: 1.5 }}>
                <label>Cost per L</label>
                <input
                  type="number"
                  name="costPerLiter"
                  placeholder="0"
                  value={product.costPerLiter}
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

          <div className="form-row">
            <div className="form-group">
              <label>Low Stock Alert (Liters)</label>
              <input
                type="number"
                name="lowStockThreshold"
                placeholder="Set low stock threshold"
                value={product.lowStockThreshold}
                onChange={handleChange}
                min="0"
                step="0.1"
              />
              <small className="hint">Leave empty to disable low stock alerts</small>
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Save Product
          </button>
        </form>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <h3>Product List</h3>
        <input
          type="text"
          placeholder="Search by brand or item name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Product List by Brand */}
      {Object.keys(filteredProducts).length > 0 ? (
        Object.keys(filteredProducts).map((brand) => (
          <div key={brand} className="brand-section">
            <div className="brand-header">{brand}</div>

            <table className="products-table">
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
                {filteredProducts[brand].map((p) => {
                  const quantity =
                    p.literUnit === "mL"
                      ? parseFloat(p.literValue) / 1000
                      : parseFloat(p.literValue);
                  const isSold = quantity <= 0;
                  const isLowStock = !isSold && p.lowStockThreshold > 0 && quantity <= p.lowStockThreshold;

                  // If this row is being edited, show inputs
                  if (editingId === p.id) {
                    return (
                      <tr
                        key={p.id}
                        className={`editing-row ${isSold ? "row-sold" : ""} ${isLowStock ? "row-low-stock" : ""}`}
                      >
                        <td>
                          <input
                            name="item"
                            value={editData.item}
                            onChange={handleEditChange}
                          />
                        </td>

                        <td>
                          <div className="edit-input-group">
                            <input
                              type="number"
                              name="literValue"
                              value={editData.literValue}
                              onChange={handleEditChange}
                            />
                            <select
                              name="literUnit"
                              value={editData.literUnit}
                              onChange={handleEditChange}
                            >
                              <option value="L">L</option>
                              <option value="mL">mL</option>
                            </select>
                          </div>
                        </td>

                        <td>
                          <div className="edit-input-group">
                            <input
                              type="number"
                              name="price"
                              value={editData.price}
                              onChange={handleEditChange}
                            />
                            <select
                              name="priceUnit"
                              value={editData.priceUnit}
                              onChange={handleEditChange}
                              style={{ fontSize: "11px" }}
                            >
                              <option value="perL">per L</option>
                              <option value="permL">per mL</option>
                            </select>
                          </div>
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
                              <label>Per L:</label>
                              <input
                                type="number"
                                name="profitPerLiter"
                                value={editData.profitPerLiter}
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
                            <div className="profit-edit-row">
                              <label>Low Stock Threshold:</label>
                              <input
                                type="number"
                                name="lowStockThreshold"
                                value={editData.lowStockThreshold}
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

                  // Normal (read-only) row
                  return (
                    <tr
                      key={p.id}
                      className={isSold ? "row-sold" : ""}
                    >
                      <td>
                        {p.item}
                        {isSold && (
                          <span className="sold-badge">SOLD</span>
                        )}
                      </td>

                      <td>
                        {p.literValue} {p.literUnit}
                      </td>

                      <td>
                        ₱{p.price} ({p.priceUnit === "perL" ? "per L" : "per mL"})
                      </td>

                      <td>
                        ₱{Number(p.cost ?? 0).toFixed(2)}
                        {((p.costPerLiter !== undefined && p.costPerLiter !== "") || (p.costPerL !== undefined)) && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            (₱{Number(p.costPerLiter ?? p.costPerL ?? 0).toFixed(2)} per L)
                          </div>
                        )}
                      </td>

                      <td>
                        Per L: ₱
                        {Number(p.profitPerLiter ?? p.profitPerL ?? 0).toFixed(
                          2
                        )}
                        <br />
                        Total: ₱{Number(p.totalProfit ?? 0).toFixed(2)}
                      </td>

                      <td className={isLowStock ? 'low-stock' : isSold ? 'sold' : 'in-stock'}>
                        {isSold ? (
                          <span>Sold Out</span>
                        ) : p.lowStockThreshold ? (
                          <>
                            <div>Current: {quantity.toFixed(2)} {p.literUnit}</div>
                            <div>Alert at: {p.lowStockThreshold}L</div>
                            {isLowStock && <div className="low-stock-badge">LOW STOCK</div>}
                          </>
                        ) : (
                          <div>{quantity.toFixed(2)} {p.literUnit}</div>
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
      ) : (
        <div className="empty-state">
          <p>No products found. Try adjusting your search or add a new product.</p>
        </div>
      )}
    </div>
  );
};

export default Product;
