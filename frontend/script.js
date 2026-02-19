// ===== script.js =====

// Basic helper toast
function showToast({ title = "Info", message = "", type = "info", timeout = 3000 }) {
  console.log(`TOAST [${type}] ${title}: ${message}`);
}

// ----------------- Support logic -----------------
async function loadSupport(options = {}) {
  try {
    const res = await fetch("http://localhost:5000/api/support");
    const data = await res.json();
    let items = Array.isArray(data) ? data : [];

    if (options.status) items = items.filter(i => i.status === options.status);
    if (options.priority) items = items.filter(i => i.priority === options.priority);
    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(i => (i.subject || "").toLowerCase().includes(q) || (i.name || "").toLowerCase().includes(q));
    }

    const tbody = document.getElementById("supportTableBody");
    tbody.innerHTML = "";

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="10">No support tickets found</td></tr>`;
      return;
    }

    items.forEach((t, i) => {
      const statusClass = t.status === "resolved" ? "resolved" : (t.status === "in-progress" ? "inprogress" : "open");
      const created = new Date(t.createdAt).toLocaleString();
      const adminReplyPreview = t.adminReply ? (t.adminReply.length > 60 ? t.adminReply.slice(0, 60) + "..." : t.adminReply) : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(t.name || "-")}</td>
        <td>${escapeHtml(t.email || "-")}</td>
        <td>${escapeHtml(t.subject || "-")}</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.message || "-")}</td>
        <td>${escapeHtml(t.priority || "-")}</td>
        <td><span class="badge ${statusClass}">${escapeHtml(t.status || "-")}</span></td>
        <td>${created}</td>
        <td title="${escapeHtml(t.adminReply || "")}">${escapeHtml(adminReplyPreview)}</td>
        <td class="actions">
          ${t.status !== 'in-progress' ? `<button class="btn-small" data-action="inprogress" data-id="${t._id}">In-Progress</button>` : ''}
          ${t.status !== 'resolved' ? `<button class="btn-small" data-action="resolve" data-id="${t._id}">Resolve</button>` : ''}
          <button class="btn-small" data-action="reply" data-id="${t._id}">Reply</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      const act = btn.dataset.action;
      const id = btn.dataset.id;
      btn.addEventListener('click', (e) => {
        if (act === 'inprogress') markInProgress(id);
        else if (act === 'resolve') markResolved(id);
        else if (act === 'reply') openReplyModal(id);
      });
    });

  } catch (err) {
    console.error("Failed to load support:", err);
    const tbody = document.getElementById("supportTableBody");
    tbody.innerHTML = `<tr><td colspan="10">Failed to load support tickets</td></tr>`;
  }
}

async function submitSupportTicket(payload) {
  try {
    const res = await fetch("http://localhost:5000/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Submit failed");
    const data = await res.json();
    showToast({ title: "Ticket Submitted", message: "Support ticket created", type: "success" });
    return data;
  } catch (err) {
    console.error("submitSupportTicket error:", err);
    showToast({ title: "Error", message: "Failed to submit ticket", type: "error" });
    throw err;
  }
}

async function markInProgress(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/support/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in-progress" }),
    });
    if (!res.ok) throw new Error("Failed");
    await loadSupport(currentFilters());
    showToast({ title: "Updated", message: "Ticket marked in-progress", type: "info" });
  } catch (err) {
    console.error(err);
    alert("Failed to mark in-progress");
  }
}

async function markResolved(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/support/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    if (!res.ok) throw new Error("Failed");
    await loadSupport(currentFilters());
    showToast({ title: "Resolved", message: "Ticket marked resolved", type: "success" });
  } catch (err) {
    console.error(err);
    alert("Failed to mark resolved");
  }
}

let replyTargetId = null;
function openReplyModal(id) {
  replyTargetId = id;
  fetch(`http://localhost:5000/api/support`)
    .then(r => r.json())
    .then(list => {
      const t = list.find(x => x._id === id);
      if (t) document.getElementById('replyTicketSubject').textContent = `Reply → ${t.subject}`;
    }).catch(()=>{});
  document.getElementById('replyMessage').value = '';
  document.getElementById('replyModal').classList.add('show');
}

async function sendReply() {
  const msg = document.getElementById('replyMessage').value.trim();
  if (!msg) return alert('Reply message cannot be empty');
  if (!replyTargetId) return alert('No ticket selected');

  try {
    const res = await fetch(`http://localhost:5000/api/support/${replyTargetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminReply: msg, status: "in-progress" }),
    });
    if (!res.ok) throw new Error("Failed to send reply");
    document.getElementById('replyModal').classList.remove('show');
    document.getElementById('replyMessage').value = '';
    replyTargetId = null;
    await loadSupport(currentFilters());
    showToast({ title: "Reply sent", message: "Admin reply saved", type: "success" });
  } catch (err) {
    console.error("sendReply error:", err);
    alert("Failed to send reply");
  }
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'`=\/]/g, function (c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#96;','=':'&#61;'})[c];
  });
}

// ----------------- MODERN RECYCLE BIN -----------------
async function loadRecycleBin() {
  try {
    const res = await fetch("http://localhost:5000/api/recycle-bin");
    const data = await res.json();
    const container = document.getElementById("recycleBinContainer");
    container.innerHTML = "";

    if (!data.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.9rem;">No deleted items found.</p>`;
      return;
    }

    data.forEach((it) => {
      const name = it.data?.name || it.data?.title || "Unnamed";
      const deleted = new Date(it.deletedAt).toLocaleString();
      const card = document.createElement("div");
      card.className = "recycle-card";
      card.innerHTML = `
        <div class="recycle-icon">
          <i class="fa-solid fa-trash-can"></i>
        </div>
        <div class="recycle-content">
          <div class="recycle-title">${escapeHtml(name)}</div>
          <div class="recycle-time">Deleted on: ${deleted}</div>
          <div class="recycle-time">Entity: ${escapeHtml(it.entityType)}</div>
          <div class="recycle-actions">
            <button class="recycle-btn restore" onclick="restoreItem('${it._id}')">Restore</button>
            <button class="recycle-btn delete" onclick="permanentDelete('${it._id}')">Delete Permanently</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load recycle bin", err);
  }
}

// ----------------- Notifications loader -----------------
async function loadNotifications(){
  try {
    const res = await fetch('http://localhost:5000/api/notifications');
    const list = await res.json();
    const container = document.getElementById('notificationsContainer');
    container.innerHTML = '';

    if (!list.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.9rem;">No notifications yet.</p>`;
      return;
    }

    list.forEach((n) => {
      const type = n.type || "info";
      const iconMap = {
        info: "fa-circle-info",
        success: "fa-check-circle",
        warning: "fa-triangle-exclamation",
        error: "fa-circle-xmark",
      };
      const icon = iconMap[type] || "fa-bell";
      const created = new Date(n.createdAt).toLocaleString();

      const card = document.createElement('div');
      card.className = `notification-card ${type} ${!n.isRead ? 'unread' : ''}`;
      card.innerHTML = `
        <div class="notification-icon ${type}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${escapeHtml(n.title)}</div>
          <div class="notification-message">${escapeHtml(n.message || '')}</div>
          <div class="notification-time">${created}</div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load notifications', err);
  }
}

// ----------------- Support form binding -----------------
function currentFilters() {
  return {
    status: document.getElementById('supportFilterStatus')?.value || '',
    priority: document.getElementById('supportFilterPriority')?.value || '',
    search: document.getElementById('supportSearch')?.value.trim() || ''
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSupport();
  await loadRecycleBin();
  await loadNotifications();
});

// ----------------- DELETE ITEM -----------------
async function deleteItem(type, id) {
  try {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This item will be moved to Recycle Bin.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    });

    if (!confirm.isConfirmed) return;

    const res = await fetch(`http://localhost:5000/api/${type}/${id}`, { method: "DELETE" });

    let data = {};
    try { data = await res.json(); } catch {}

    if (res.status === 200 || data?.success) {
      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: `${type.slice(0, -1)} moved to Recycle Bin.`,
        timer: 1400,
        showConfirmButton: false
      });
      loadRecycleBin();
      loadNotifications();
    } else {
      throw new Error(`Unexpected response: ${res.status}`);
    }
  } catch (err) {
    console.error("Delete error:", err);
    Swal.fire({
      icon: "error",
      title: "Failed!",
      text: "Something went wrong while deleting. Please try again.",
    });
  }
}

// ----------------- RESTORE ITEM -----------------
async function restoreItem(id) {
  Swal.fire({
    title: "Restore this item?",
    text: "It will be moved back to its original list.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Restore",
  }).then(async (res) => {
    if (!res.isConfirmed) return;
    try {
      await fetch(`http://localhost:5000/api/recycle-bin/${id}/restore`, { method: "POST" });
      Swal.fire("Restored!", "Item restored successfully.", "success");
      loadRecycleBin();
      loadNotifications();
    } catch {
      Swal.fire("Error", "Failed to restore item.", "error");
    }
  });
}

// ----------------- PERMANENT DELETE -----------------
async function permanentDelete(id) {
  Swal.fire({
    title: "Delete Permanently?",
    text: "This item will be permanently removed!",
    icon: "error",
    showCancelButton: true,
    confirmButtonText: "Delete",
    confirmButtonColor: "#ef4444"
  }).then(async (res) => {
    if (!res.isConfirmed) return;
    try {
      await fetch(`http://localhost:5000/api/recycle-bin/${id}`, { method: "DELETE" });
      Swal.fire("Deleted!", "Item permanently deleted.", "success");
      loadRecycleBin();
      loadNotifications();
    } catch {
      Swal.fire("Error", "Failed to delete permanently.", "error");
    }
  });
}
