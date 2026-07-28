import * as profileService from '../../services/profile.js';
import { Modal } from 'bootstrap';
import myProfileTemplate from './my-profile.html?raw';
import './my-profile.css';

let bankDetailModal;
let currentBankDetails = [];

function renderBankDetails(bankDetails) {
    const container = document.getElementById('bank-details-container');
    container.innerHTML = bankDetails.map(detail => `
        <div class="card bank-detail-card">
            <div class="card-body">
                <h6 class="card-subtitle mb-2 text-muted">${detail.account_type.replace('_', ' ')}</h6>
                <p class="card-text"><strong>Bank:</strong> ${detail.bank_name || 'N/A'}</p>
                <p class="card-text"><strong>IBAN:</strong> ${detail.iban || 'N/A'}</p>
                <p class="card-text"><strong>Currency:</strong> ${detail.currency || 'N/A'}</p>
                <button class="btn btn-sm btn-outline-primary edit-bank-detail-btn" data-id="${detail.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger delete-bank-detail-btn" data-id="${detail.id}">Delete</button>
            </div>
        </div>
    `).join('');
}

function populateProfileForm(profile, email) {
    document.getElementById('profile-email').textContent = email || '';
    if (!profile) return;
    document.getElementById('first-name').value = profile.first_name || '';
    document.getElementById('last-name').value = profile.last_name || '';
    document.getElementById('display-name').value = profile.display_name || '';
    document.getElementById('phone-number').value = profile.phone_number || '';
    document.getElementById('notes').value = profile.notes || '';
    document.getElementById('profile-display-name').textContent = profile.display_name || 'Display Name';
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    document.getElementById('profile-full-name').textContent = fullName || 'Full Name';
    const profilePic = document.getElementById('profile-picture-img');
    if (profile.profile_picture_url) {
        profilePic.src = profile.profile_picture_url;
    } else {
        profilePic.src = 'https://via.placeholder.com/150';
    }
}

async function handleSaveProfile(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const profileData = Object.fromEntries(formData.entries());
    
    try {
        const { profile, email } = await profileService.updateProfile(profileData);
        populateProfileForm(profile, email);
        alert('Profile updated successfully!');
    } catch (error) {
        alert('Failed to update profile.');
    }
}

function openBankDetailModal(detailId = null) {
    const form = document.getElementById('bank-detail-form');
    form.reset();
    document.getElementById('bank-detail-id').value = '';

    if (detailId) {
        const detail = currentBankDetails.find(d => d.id === detailId);
        if (detail) {
            document.getElementById('bank-detail-id').value = detail.id;
            document.getElementById('account-type').value = detail.account_type;
            document.getElementById('bank-name').value = detail.bank_name || '';
            document.getElementById('account-number').value = detail.account_number || '';
            document.getElementById('iban').value = detail.iban || '';
            document.getElementById('swift-bic').value = detail.swift_bic || '';
            document.getElementById('currency').value = detail.currency || 'USD';
        }
    }
    bankDetailModal.show();
}

async function handleSaveBankDetail() {
    const form = document.getElementById('bank-detail-form');
    const formData = new FormData(form);
    const bankDetailData = Object.fromEntries(formData.entries());

    // If the id is empty, it's a new record, so we shouldn't send an empty id field
    if (!bankDetailData.id) {
        delete bankDetailData.id;
    }
    
    try {
        await profileService.upsertBankDetail(bankDetailData);
        const { bankDetails } = await profileService.getProfile();
        currentBankDetails = bankDetails;
        renderBankDetails(bankDetails);
        bankDetailModal.hide();
        alert('Bank detail saved successfully!');
    } catch (error) {
        alert('Failed to save bank detail.');
    }
}

async function handleDeleteBankDetail(e) {
    if (!e.target.classList.contains('delete-bank-detail-btn')) return;
    const detailId = e.target.dataset.id;
    if (confirm('Are you sure you want to delete this bank account?')) {
        try {
            await profileService.deleteBankDetail(detailId);
            const { bankDetails } = await profileService.getProfile();
            currentBankDetails = bankDetails;
            renderBankDetails(bankDetails);
            alert('Bank detail deleted successfully!');
        } catch (error) {
            alert('Failed to delete bank detail.');
        }
    }
}

async function handleUploadPicture(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const newUrl = await profileService.uploadProfilePicture(file);
        document.getElementById('profile-picture-img').src = newUrl;
        alert('Profile picture uploaded successfully!');
    } catch (error) {
        alert('Failed to upload profile picture. Make sure it is an image and under 2MB.');
    }
}

async function handleDeletePicture() {
    if (confirm('Are you sure you want to delete your profile picture?')) {
        try {
            await profileService.deleteProfilePicture();
            document.getElementById('profile-picture-img').src = 'https://via.placeholder.com/150';
            alert('Profile picture deleted successfully!');
        } catch (error) {
            alert('Failed to delete profile picture.');
        }
    }
}

export function renderMyProfilePage(container) {
    container.innerHTML = myProfileTemplate;

    bankDetailModal = new Modal(document.getElementById('bank-detail-modal'));

    document.getElementById('profile-form').addEventListener('submit', handleSaveProfile);
    document.getElementById('add-bank-account-btn').addEventListener('click', () => openBankDetailModal());
    document.getElementById('save-bank-detail-btn').addEventListener('click', handleSaveBankDetail);
    document.getElementById('bank-details-container').addEventListener('click', e => {
        if (e.target.classList.contains('edit-bank-detail-btn')) {
            openBankDetailModal(e.target.dataset.id);
        }
    });
    document.getElementById('bank-details-container').addEventListener('click', handleDeleteBankDetail);
    
    document.getElementById('upload-picture-btn').addEventListener('click', () => {
        document.getElementById('profile-picture-upload').click();
    });
    document.getElementById('profile-picture-upload').addEventListener('change', handleUploadPicture);
    document.getElementById('delete-picture-btn').addEventListener('click', handleDeletePicture);

    profileService.getProfile().then(({ profile, bankDetails, email }) => {
        populateProfileForm(profile, email);
        currentBankDetails = bankDetails;
        renderBankDetails(bankDetails);
    });
}
