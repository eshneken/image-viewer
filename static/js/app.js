// Global variables
let currentImageIndex = 0;
let currentPageImages = [];
let allImages = [];
let currentPage = 1;
let totalPages = 1;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading indicator initially
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    
    // Initialize current page images from the gallery
    initializeCurrentPageImages();
    
    // Initialize pagination variables from the server-rendered data
    initializePaginationFromServer();
    
    // Add click event listeners to view buttons on initial page load
    addViewButtonListeners();
    
    // Add keyboard event listeners for modal navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Add click event listener to modal background for closing
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Add window resize handler for responsive modal
    window.addEventListener('resize', handleWindowResize);
    
    // Add touch events for mobile
    addTouchSupport();
});

// Initialize current page images from the gallery
function initializeCurrentPageImages() {
    const imageCards = document.querySelectorAll('.image-card');
    currentPageImages = Array.from(imageCards).map(card => ({
        name: card.dataset.imageName,
        url: card.dataset.imageUrl
    }));
}

// Initialize pagination variables from server-rendered data
function initializePaginationFromServer() {
    // Get pagination info from the server-rendered HTML
    const currentPageSpan = document.getElementById('current-page');
    
    if (currentPageSpan) {
        // Extract current page and total pages from the span text (e.g., "Page 1 of 25")
        const pageText = currentPageSpan.textContent;
        const pageMatch = pageText.match(/Page (\d+) of (\d+)/);
        
        if (pageMatch) {
            currentPage = parseInt(pageMatch[1]);
            totalPages = parseInt(pageMatch[2]);
            console.log(`Initialized pagination: currentPage=${currentPage}, totalPages=${totalPages}`);
        }
    }
}

// Add click event listeners to view buttons
function addViewButtonListeners() {
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const imageName = this.getAttribute('data-image-name');
            const imageUrl = this.getAttribute('data-image-url');
            openModal(imageName, imageUrl);
        });
    });
}

// Change page function - must be in global scope for onclick handlers
window.changePage = function(page) {
    console.log(`changePage called with page=${page}, totalPages=${totalPages}`);
    
    if (page < 1 || page > totalPages) {
        console.log(`Invalid page: ${page}, valid range is 1-${totalPages}`);
        return;
    }
    
    // Show loading modal
    showLoading();
    
    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    
    // Fetch new page data
    fetch(`/api/images?page=${page}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);
            // Small delay to ensure smooth transition
            setTimeout(() => {
                updateGallery(data);
                currentPage = page;
                hideLoading();
            }, 100);
        })
        .catch(error => {
            console.error('Error loading page:', error);
            hideLoading();
            // Fallback to page reload
            window.location.href = `/?page=${page}`;
        });
    
    // Prevent default action
    return false;
};

// Update gallery with new data
function updateGallery(data) {
    const gallery = document.getElementById('gallery');
    const pagination = document.querySelector('.pagination');
    
    // Update current page images
    currentPageImages = data.images;
    allImages = data.images;
    totalPages = data.pagination.total_pages;
    
    // Update gallery HTML
    gallery.innerHTML = data.images.map(image => `
        <div class="image-card" data-image-name="${image.name}" data-image-url="${image.url}">
            <div class="image-container">
                ${image.thumbnail ? 
                    `<img src="${image.thumbnail}" alt="${image.name}" class="gallery-image" loading="lazy">` :
                    `<div class="image-placeholder">
                        <i class="fas fa-image"></i>
                        <span>${image.name}</span>
                    </div>`
                }
                <div class="image-overlay">
                    <button class="view-btn" data-image-name="${image.name}" data-image-url="${image.url}">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
            </div>
            <div class="image-info">
                <span class="image-name">${image.name}</span>
            </div>
        </div>
    `).join('');
    
    // Add click event listeners to view buttons
    addViewButtonListeners();
    
    // Update pagination
    updatePagination(data.pagination);
    
    // Update stats
    updateStats(data.pagination);
}

// Update pagination controls
function updatePagination(pagination) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer) return;
    
    let paginationHTML = '';
    
    // Previous button
    if (pagination.has_prev) {
        paginationHTML += `
            <button class="page-btn" onclick="changePage(${pagination.current_page - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
    }
    
    // Page numbers
    paginationHTML += '<div class="page-numbers">';
    for (let pageNum = 1; pageNum <= pagination.total_pages; pageNum++) {
        if (pageNum === pagination.current_page) {
            paginationHTML += `<span class="page-number active">${pageNum}</span>`;
        } else if (pageNum <= 3 || pageNum > pagination.total_pages - 3 || 
                   (pageNum >= pagination.current_page - 1 && pageNum <= pagination.current_page + 1)) {
            paginationHTML += `<button class="page-number" onclick="changePage(${pageNum})">${pageNum}</button>`;
        } else if (pageNum === 4 && pagination.current_page > 6) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        } else if (pageNum === pagination.total_pages - 3 && pagination.current_page < pagination.total_pages - 5) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        }
    }
    paginationHTML += '</div>';
    
    // Next button
    if (pagination.has_next) {
        paginationHTML += `
            <button class="page-btn" onclick="changePage(${pagination.current_page + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

// Update stats display
function updateStats(pagination) {
    const totalImages = document.getElementById('total-images');
    const currentPageSpan = document.getElementById('current-page');
    
    if (totalImages) {
        totalImages.textContent = `${pagination.total_images} images`;
    }
    if (currentPageSpan) {
        currentPageSpan.textContent = `Page ${pagination.current_page} of ${pagination.total_pages}`;
    }
}

// Show loading modal
function showLoading() {
    console.log('showLoading called');
    const loading = document.getElementById('loading');
    if (loading) {
        console.log('Found loading element, adding active class');
        loading.style.display = 'flex'; // Ensure it's visible
        loading.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling while loading
    } else {
        console.error('Loading element not found!');
    }
}

// Hide loading modal
function hideLoading() {
    console.log('hideLoading called');
    const loading = document.getElementById('loading');
    if (loading) {
        console.log('Found loading element, removing active class');
        loading.classList.remove('active');
        // Add a small delay before hiding to allow for fade-out animation
        setTimeout(() => {
            loading.style.display = 'none';
        }, 300);
        document.body.style.overflow = ''; // Re-enable scrolling
    }
}

// Open modal with image
function openModal(imageName, imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const imageNameSpan = document.getElementById('imageName');
    const imageCounterSpan = document.getElementById('imageCounter');
    const imageLoading = document.getElementById('imageLoading');
    
    // Find current image index
    currentImageIndex = currentPageImages.findIndex(img => img.name === imageName);
    
    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Show loading
    imageLoading.style.display = 'flex';
    modalImage.style.display = 'none';
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Load image
    loadModalImage(imageUrl, imageName);
    
    // Update image details
    imageNameSpan.textContent = imageName;
    imageCounterSpan.textContent = `${currentImageIndex + 1} of ${currentPageImages.length}`;
    
    // Preload adjacent images
    preloadAdjacentImages();
}

// Load image in modal
function loadModalImage(imageUrl, imageName) {
    const modalImage = document.getElementById('modalImage');
    const imageLoading = document.getElementById('imageLoading');
    
    if (!modalImage || !imageLoading) return;
    
    // Show loading indicator and hide previous image
    imageLoading.style.display = 'flex';
    modalImage.style.display = 'none';
    
    // Set image data attributes
    modalImage.setAttribute('data-image-name', imageName);
    
    // Create a new image object to handle loading
    const img = new Image();
    
    img.onload = function() {
        // Set the image source
        modalImage.src = imageUrl;
        modalImage.alt = imageName;
        
        // Hide loading indicator and show the image
        imageLoading.style.display = 'none';
        modalImage.style.display = 'block';
        
        // Ensure image fits within viewport after a small delay
        setTimeout(ensureImageFits, 50);
    };
    
    img.onerror = function() {
        // Handle error - show placeholder or error message
        imageLoading.innerHTML = `
            <div style="text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #e53e3e; margin-bottom: 10px;"></i>
                <p>Failed to load image</p>
                <button onclick="location.reload()" class="page-btn" style="margin-top: 10px;">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
    };
    
    // Start loading the image
    img.src = imageUrl;
}

// Ensure image fits within viewport
function ensureImageFits() {
    const modalImage = document.getElementById('modalImage');
    const imageDisplay = document.querySelector('.image-display');
    
    if (!modalImage || !imageDisplay) return;
    
    // Reset any previous transformations and show the image
    modalImage.style.transform = 'scale(1)';
    
    // Get viewport and container dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalContent = document.querySelector('.modal-content');
    const modalRect = modalContent.getBoundingClientRect();
    
    // Calculate available space with more generous vertical padding
    const padding = 5; // Minimal side padding
    const headerHeight = 20; // Slightly more header space
    const controlsHeight = 40; // More space for controls
    
    // Calculate available space with extra vertical buffer
    const availableWidth = modalRect.width - (padding * 2);
    const availableHeight = viewportHeight - (headerHeight + controlsHeight + padding * 2) - 50; // Reduced buffer to 20px
    
    // Get natural image dimensions
    const imgWidth = modalImage.naturalWidth || modalImage.width;
    const imgHeight = modalImage.naturalHeight || modalImage.height;
    
    if (!imgWidth || !imgHeight) {
        // If we can't get dimensions, try again after a short delay
        setTimeout(ensureImageFits, 100);
        return;
    }
    
    // Calculate scale to fit image within available space
    const scaleX = availableWidth / imgWidth;
    const scaleY = availableHeight / imgHeight;
    
    // Even more aggressive scaling for portrait images
    const isPortrait = imgHeight > imgWidth;
    const scaleFactor = isPortrait ? 0.76 : 0.76; // More reduction for portrait
    const scale = Math.min(scaleX, scaleY, 0.90) * scaleFactor; // Cap at 95% of viewport
    
    // Apply the scale
    modalImage.style.transform = `scale(${scale})`;
    
    // Position the image with even more space at the top for portrait mode
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;
    const offsetX = Math.max(0, (availableWidth - scaledWidth) / 2);
    
    // Fixed top margin for portrait, centered for landscape
    let offsetY;
    if (isPortrait) {
        // Fixed 40px top margin for portrait
        offsetY = 40;
    } else {
        // Center landscape images with 35% from top
        offsetY = (availableHeight - scaledHeight) * 0.35;
    }
    
    // Apply styles to maximize visible area
    modalImage.style.maxWidth = 'none';
    modalImage.style.maxHeight = 'none';
    modalImage.style.margin = `${offsetY}px ${offsetX}px`;
    
    // Ensure the image display container is properly sized
    const container = document.querySelector('.image-display');
    if (container) {
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
    }
}

// Handle window resize
function handleWindowResize() {
    const modal = document.getElementById('imageModal');
    if (modal && modal.style.display === 'block') {
        ensureImageFits();
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Navigate to previous/next image
function navigateImage(direction) {
    const modalImage = document.getElementById('modalImage');
    if (!modalImage) return;
    
    const currentIndex = currentPageImages.findIndex(img => img.name === modalImage.dataset.imageName);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 1 ? currentIndex + 1 : currentIndex - 1;
    
    // Check if we're at the first or last image
    if (newIndex >= 0 && newIndex < currentPageImages.length) {
        const image = currentPageImages[newIndex];
        // Update the current image index for reference
        currentImageIndex = newIndex;
        
        // Update modal content
        const imageNameSpan = document.getElementById('imageName');
        const imageCounterSpan = document.getElementById('imageCounter');
        
        if (imageNameSpan) imageNameSpan.textContent = image.name;
        if (imageCounterSpan) imageCounterSpan.textContent = `${currentImageIndex + 1} of ${currentPageImages.length}`;
        
        // Load the new image
        loadModalImage(image.url, image.name);
        
        // Update navigation buttons after a small delay to ensure UI is updated
        setTimeout(updateNavigationButtons, 50);
    }
}

// Update navigation buttons state
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentImageIndex <= 0;
    }
    if (nextBtn) {
        nextBtn.disabled = currentImageIndex >= currentPageImages.length - 1;
    }
}

// Handle keyboard navigation
function handleKeyboardNavigation(event) {
    const modal = document.getElementById('imageModal');
    
    if (modal.style.display === 'block') {
        switch (event.key) {
            case 'Escape':
                closeModal();
                break;
            case 'ArrowLeft':
                navigateImage(-1);
                break;
            case 'ArrowRight':
                navigateImage(1);
                break;
        }
    }
}

// Download current image
function downloadCurrentImage() {
    const modalImage = document.getElementById('modalImage');
    if (!modalImage || !modalImage.src) return;
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = modalImage.src;
    
    // Get the filename from the image source or use a default name
    const url = new URL(modalImage.src);
    const pathParts = url.pathname.split('/');
    let filename = pathParts[pathParts.length - 1];
    
    // If we can't get a good filename from the URL, use the image name from the UI
    if (!filename || filename === '') {
        const imageNameElement = document.getElementById('imageName');
        filename = imageNameElement ? imageNameElement.textContent + '.jpg' : 'image.jpg';
    }
    
    // Set download attributes
    link.download = filename;
    link.target = '_blank';
    
    // iOS devices require the link to be in the DOM to work
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // For iOS, we need to handle the download differently
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', modalImage.src, true);
        xhr.responseType = 'blob';
        xhr.onload = function() {
            const url = window.URL.createObjectURL(xhr.response);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        };
        xhr.send();
    }
}

// Add touch support for mobile devices
function addTouchSupport() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;
    
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    
    modal.addEventListener('touchstart', function(e) {
        startX = e.changedTouches[0].screenX;
        startY = e.changedTouches[0].screenY;
    }, false);
    
    modal.addEventListener('touchend', function(e) {
        endX = e.changedTouches[0].screenX;
        endY = e.changedTouches[0].screenY;
        handleSwipe();
    }, false);
    
    function handleSwipe() {
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Minimum swipe distance
        const minSwipeDistance = 50;
        
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
            if (diffX > 0) {
                // Swipe left - next image
                navigateImage(1);
            } else {
                // Swipe right - previous image
                navigateImage(-1);
            }
        }
    }
}

// Preload next/previous images for smoother navigation
function preloadAdjacentImages() {
    const preloadIndexes = [];
    
    if (currentImageIndex > 0) {
        preloadIndexes.push(currentImageIndex - 1);
    }
    if (currentImageIndex < currentPageImages.length - 1) {
        preloadIndexes.push(currentImageIndex + 1);
    }
    
    preloadIndexes.forEach(index => {
        const image = currentPageImages[index];
        if (image && image.url) {
            const img = new Image();
            img.src = image.url;
        }
    });
}

// Add smooth scrolling for pagination
function smoothScrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Enhanced change page with smooth scroll
function changePageWithScroll(page) {
    changePage(page);
    setTimeout(smoothScrollToTop, 100);
}
