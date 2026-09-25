import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { CATEGORY_LABELS, errMsg, formatPHP } from '../../utils/format';

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ProductCard({ p, onOpenStore }) {
  const { addItem } = useCart();
  const out = p.stock === 0;

  return (
    <div className={`product-card ${out ? 'is-out' : ''}`}>
      {p.onPromo && <span className="ribbon">PROMO</span>}
      <div className="product-top">
        <span className="cat-tag">{CATEGORY_LABELS[p.category] || 'LPG'}</span>
        <span className="muted small">{p.sold} sold</span>
      </div>
      <h3>{p.name}</h3>
      <p className="muted small">{[p.brand, p.sizeKg ? `${p.sizeKg} kg` : null].filter(Boolean).join(' · ') || '—'}</p>
      {onOpenStore && (
        <button className="link-btn" onClick={() => onOpenStore(p.storeId)}>
          🏪 {p.storeName}
        </button>
      )}
      <div className="price-row">
        <strong className="price">{formatPHP(p.effectivePrice)}</strong>
        {p.onPromo && <s className="muted small">{formatPHP(p.price)}</s>}
      </div>
      <div className="product-foot">
        <span className={`small ${out ? 'text-danger' : p.stock <= 5 ? 'text-warn' : 'muted'}`}>
          {out ? 'Out of stock' : `${p.stock} in stock`}
        </span>
        <button className="btn-solid small" disabled={out} onClick={() => addItem(p, 1)}>
          Add to cart
        </button>
      </div>
    </div>
  );
}

function StoreCard({ s, onOpen }) {
  return (
    <button className="store-card" onClick={() => onOpen(s.id)}>
      <div className="store-avatar">{s.name.charAt(0).toUpperCase()}</div>
      <div className="store-info">
        <h3>{s.name}</h3>
        <p className="muted small">{s.address || 'No address listed'}</p>
        <div className="chip-row">
          <span className="chip">{s.productCount} products</span>
          {s.minPrice != null && <span className="chip">from {formatPHP(s.minPrice)}</span>}
          {s.promoCount > 0 && <span className="chip promo">🔥 {s.promoCount} promo</span>}
          <span className="chip">{s.totalSold} sold</span>
        </div>
      </div>
    </button>
  );
}

export default function CustomerDashboard({ user }) {
  const [tab, setTab] = useState('stores'); // stores | products
  const [openStoreId, setOpenStoreId] = useState(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeDetail, setStoreDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = useDebounced(search);
  const minP = useDebounced(minPrice, 500);
  const maxP = useDebounced(maxPrice, 500);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (openStoreId) {
          const res = await api.get(`/shop/stores/${openStoreId}`);
          if (!cancelled) setStoreDetail(res.data);
        } else if (tab === 'stores') {
          const res = await api.get('/shop/stores', {
            params: { search: q, sort: sort || 'name', promo: promoOnly ? 'true' : undefined },
          });
          if (!cancelled) setStores(res.data);
        } else {
          const res = await api.get('/shop/products', {
            params: {
              search: q,
              sort: sort || 'price_asc',
              promo: promoOnly ? 'true' : undefined,
              category: category || undefined,
              minPrice: minP || undefined,
              maxPrice: maxP || undefined,
            },
          });
          if (!cancelled) setProducts(res.data);
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, 'Could not load the shop.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tab, openStoreId, q, sort, promoOnly, category, minP, maxP]);

  function openStore(id) {
    setStoreDetail(null);
    setSearch('');
    setPromoOnly(false);
    setOpenStoreId(id);
  }

  function switchTab(t) {
    setOpenStoreId(null);
    setTab(t);
    setSort('');
  }

  // ---------- single store view ----------
  if (openStoreId) {
    const visible = (storeDetail?.products || []).filter(
      (p) =>
        (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase())) &&
        (!promoOnly || p.onPromo)
    );
    return (
      <>
        <button className="link-btn back" onClick={() => setOpenStoreId(null)}>
          ← Back to browsing
        </button>
        {error && <div className="message error">{error}</div>}
        {storeDetail && (
          <>
            <div className="panel store-header">
              <div className="store-avatar big">{storeDetail.store.name.charAt(0).toUpperCase()}</div>
              <div>
                <h1>{storeDetail.store.name}</h1>
                <p className="muted small">
                  {[storeDetail.store.address, storeDetail.store.phone].filter(Boolean).join(' · ') || 'No contact info yet'}
                </p>
                {storeDetail.store.description && <p className="small">{storeDetail.store.description}</p>}
              </div>
            </div>
            <div className="filter-bar">
              <input placeholder="Search this store..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <label className="toggle">
                <input type="checkbox" checked={promoOnly} onChange={(e) => setPromoOnly(e.target.checked)} /> Promos only
              </label>
            </div>
            {visible.length === 0 ? (
              <p className="empty">No products match.</p>
            ) : (
              <div className="product-grid">
                {visible.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </>
        )}
        {loading && !storeDetail && <p className="empty">Loading...</p>}
      </>
    );
  }

  // ---------- browse view ----------
  return (
    <>
      <div className="hero">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p>Find LPG from stores near you and get it delivered.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'stores' ? 'active' : ''} onClick={() => switchTab('stores')}>
          🏪 Browse Stores
        </button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => switchTab('products')}>
          🔥 LPG Products
        </button>
      </div>

      <div className="filter-bar">
        <input
          placeholder={tab === 'stores' ? 'Search stores...' : 'Search LPG, brand...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {tab === 'stores' ? (
            <>
              <option value="">Sort: Name (A–Z)</option>
              <option value="price_asc">Lowest price first</option>
              <option value="price_desc">Highest price first</option>
              <option value="sales_desc">Highest sales</option>
              <option value="sales_asc">Lowest sales</option>
            </>
          ) : (
            <>
              <option value="">Sort: Lowest price</option>
              <option value="price_desc">Highest price first</option>
              <option value="sales_desc">Highest sales</option>
              <option value="sales_asc">Lowest sales</option>
              <option value="newest">Newest</option>
            </>
          )}
        </select>
        {tab === 'products' && (
          <>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All types</option>
              <option value="lpg">LPG Tank</option>
              <option value="refill">Refill</option>
              <option value="accessory">Accessory</option>
            </select>
            <input className="price-input" type="number" min="0" placeholder="Min ₱" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <input className="price-input" type="number" min="0" placeholder="Max ₱" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </>
        )}
        <label className="toggle">
          <input type="checkbox" checked={promoOnly} onChange={(e) => setPromoOnly(e.target.checked)} /> 🔥 Promos only
        </label>
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : tab === 'stores' ? (
        stores.length === 0 ? (
          <p className="empty">No stores found.</p>
        ) : (
          <div className="store-grid">
            {stores.map((s) => (
              <StoreCard key={s.id} s={s} onOpen={openStore} />
            ))}
          </div>
        )
      ) : products.length === 0 ? (
        <p className="empty">No products found.</p>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} onOpenStore={openStore} />
          ))}
        </div>
      )}
    </>
  );
}
