import React, { useState, useEffect } from 'react';
import './index.css'; // Tailwind / custom CSS
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Chart } from 'chart.js/auto';

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export default function App() {
  // ----- AUTH STATES -----
  const [userRole, setUserRole] = useState(null); // 'staff', 'admin'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // ----- DASHBOARD STATES -----
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 100;

  // ----- IMPORT STATE -----
  const [massData, setMassData] = useState('');

  // ----- Login Handler -----
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, username + '@iku.com', password);
      if(username === 'admin') setUserRole('admin');
      else setUserRole('staff');
      setLoginError('');
      fetchRecords();
    } catch (err) {
      setLoginError('Invalid username or password');
    }
  };

  // ----- Fetch Records -----
  const fetchRecords = async () => {
    const q = collection(db, "library_records");
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setRecords(data);
    setFilteredRecords(data);
  };

  // ----- Mass Import -----
  const handleMassImport = async () => {
    const rows = massData.split('\n').map(r => r.split('\t'));
    const header = rows[0];
    const body = rows.slice(1);

    // Duplicate check
    const existing = records.map(r => r.controlNumber + r.accession);
    for(const r of body){
      const key = r[1]+r[4]; // CONTROL NUMBER + ACCESSION
      if(existing.includes(key)){
        alert('Duplicate record detected. Import rejected.');
        return;
      }
    }

    // Add to Firestore
    for(const r of body){
      await addDoc(collection(db, "library_records"), {
        no: r[0],
        controlNumber: r[1],
        callNo082: r[2],
        callNo050060: r[3],
        accession: r[4],
        title: r[5],
        status: r[6]==='Completed'?'Complete':r[6],
        staff: r[7],
        date: r[8],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    alert('All records imported successfully. Data verified.');
    setMassData('');
    fetchRecords();
  };

  // ----- Filters -----
  useEffect(() => {
    let data = [...records];
    if(statusFilter) data = data.filter(r=>r.status===statusFilter);
    if(staffFilter) data = data.filter(r=>r.staff===staffFilter);
    if(searchTerm) data = data.filter(r=>r.title.includes(searchTerm) || r.accession.includes(searchTerm));
    setFilteredRecords(data);
    setCurrentPage(1);
  }, [statusFilter, staffFilter, searchTerm, records]);

  // ----- Pagination -----
  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

  // ----- KPI Calculation -----
  const totalRecords = records.length;
  const completeRecords = records.filter(r=>r.status==='Complete').length;
  const incompleteRecords = records.filter(r=>r.status==='Incomplete').length;
  const staffActive = [...new Set(records.map(r=>r.staff))].length;

  // ----- Table Editable Handler -----
  const handleEdit = (id, field, value) => {
    setRecords(prev=>prev.map(r=>{
      if(r.id===id) return {...r, [field]: value, updatedAt:new Date()};
      return r;
    }));
  };

  // ----- Render -----
  if(!userRole){
    // -------- LOGIN PAGE --------
    return (
      <div className="flex items-center justify-center h-screen bg-[#CCE5FF]">
        <div className="w-[600px] h-[400px] p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Senarai Buku IKU</h1>
          <p className="mb-6 text-sm">Sistem Pengurusan Koleksi Buku – Tukar DDC kepada NLM/LC</p>
          <input placeholder="Username" className="border p-2 w-full mb-3" value={username} onChange={e=>setUsername(e.target.value)} />
          <input type="password" placeholder="Password" className="border p-2 w-full mb-3" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="bg-gradient-to-r from-[#0055A5] to-[#003366] text-white rounded px-4 py-2" onClick={handleLogin}>Login</button>
          {loginError && <p className="text-red-600 mt-2">{loginError}</p>}
          <p className="text-center text-xs mt-6">© 2026 IKU Library System</p>
        </div>
      </div>
    )
  }

  // -------- DASHBOARD PAGE --------
  return (
    <div className="min-h-screen bg-[#CCE5FF] p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Senarai Buku IKU</h1>
        </div>
        <div>{new Date().toLocaleString('en-US', {hour12:true})}</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded shadow text-center">Total Records: {totalRecords}</div>
        <div className="bg-white p-4 rounded shadow text-center">Complete: {completeRecords}</div>
        <div className="bg-white p-4 rounded shadow text-center">Incomplete: {incompleteRecords}</div>
        <div className="bg-white p-4 rounded shadow text-center">Staff Active: {staffActive}</div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="p-2 border rounded">
          <option value="">All Status</option>
          <option value="Complete">Complete</option>
          <option value="Incomplete">Incomplete</option>
        </select>
        <select value={staffFilter} onChange={e=>setStaffFilter(e.target.value)} className="p-2 border rounded">
          <option value="">All Staff</option>
          <option value="FATIHAH">FATIHAH</option>
          <option value="FAZILAH">FAZILAH</option>
          <option value="SAKINAH">SAKINAH</option>
          <option value="HUSNA">HUSNA</option>
          <option value="ALIA">ALIA</option>
          <option value="EYZAN">EYZAN</option>
          <option value="USER">USER</option>
        </select>
        <input type="text" placeholder="Search TITLE / ACCESSION" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border p-2 rounded flex-1" />
      </div>

      {/* Mass Import */}
      {userRole==='admin' && (
        <div className="mb-4">
          <textarea value={massData} onChange={e=>setMassData(e.target.value)} placeholder="Paste 3879 records here (tab-separated)" className="w-full border p-2 h-32 mb-2"></textarea>
          <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={handleMassImport}>Import Records</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 text-center">
          <thead className="bg-[#EAF3FF]">
            <tr>
              {["NO","CONTROL NUMBER","CALL NO (082)","CALL NO (050/060)","ACCESSION","TITLE","STATUS","STAFF","DATE"].map(h=>(
                <th key={h} className="border p-1 text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRecords.map(r=>(
              <tr key={r.id} className="hover:bg-gray-100">
                <td className="border p-1 text-xs">{r.no}</td>
                <td className="border p-1 text-xs">
                  <input value={r.controlNumber||''} onChange={e=>handleEdit(r.id,'controlNumber',e.target.value)} className="w-full text-center text-xs"/>
                </td>
                <td className="border p-1 text-xs">{r.callNo082}</td>
                <td className="border p-1 text-xs">
                  <input value={r.callNo050060||''} onChange={e=>handleEdit(r.id,'callNo050060',e.target.value)} className="w-full text-center text-xs"/>
                </td>
                <td className="border p-1 text-xs">{r.accession}</td>
                <td className="border p-1 text-xs text-left break-words">{r.title}</td>
                <td className="border p-1 text-xs">
                  <select value={r.status} onChange={e=>handleEdit(r.id,'status',e.target.value)} className="w-full text-center text-xs">
                    <option value="Complete">Complete</option>
                    <option value="Incomplete">Incomplete</option>
                  </select>
                </td>
                <td className="border p-1 text-xs">
                  <select value={r.staff} onChange={e=>handleEdit(r.id,'staff',e.target.value)} className="w-full text-center text-xs">
                    <option value="FATIHAH">FATIHAH</option>
                    <option value="FAZILAH">FAZILAH</option>
                    <option value="SAKINAH">SAKINAH</option>
                    <option value="HUSNA">HUSNA</option>
                    <option value="ALIA">ALIA</option>
                    <option value="EYZAN">EYZAN</option>
                    <option value="USER">USER</option>
                  </select>
                </td>
                <td className="border p-1 text-xs">
                  <input value={r.date||''} onChange={e=>handleEdit(r.id,'date',e.target.value)} className="w-full text-center text-xs"/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center mt-2 gap-2">
        <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)} className="px-2 py-1 bg-gray-300 rounded">Prev</button>
        <span className="px-2 py-1">{currentPage}/{totalPages}</span>
        <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)} className="px-2 py-1 bg-gray-300 rounded">Next</button>
      </div>
    </div>
  );
}