/* ==========================================================================
   TUSKER INN FOREST LODGE - JAVASCRIPT ANIMATION ENGINE
   High-performance canvas frame scrubbing and scroll timeline logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  const preloader = document.getElementById('preloader');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const heroContent = document.getElementById('hero-content');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const scrollTrack = document.querySelector('.scroll-track');
  const navbar = document.querySelector('.navbar');

  // Animation configuration: use robust media query and touch checks to bypass mobile viewport race conditions on load
  const isMobile = window.matchMedia("(max-width: 1024px)").matches || 
                   window.matchMedia("(orientation: portrait)").matches || 
                   ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0);
  const totalFrames = isMobile ? 107 : 102;
  const images = [];
  let loadedCount = 0;
  let currentFrameIndex = 1;
  let targetFrameIndex = 1;
  let lastDrawnIndex = -1;
  let isAnimating = false;

  // Disable scroll during preloading
  document.body.style.overflow = 'hidden';

  // Path generator for frame sequence
  function getFramePath(index) {
    const paddedIndex = String(index).padStart(3, '0');
    if (isMobile) {
      return `Mobile responsive/frame_${paddedIndex}.jpg?v=1`;
    } else {
      return `hero animation/frame_${paddedIndex}.jpg?v=1`;
    }
  }

  let hasStarted = false;

  // Preload all frames
  function preloadImages() {
    console.log("[Tusker Inn] Preloading frames. Mode:", isMobile ? "Mobile Responsive" : "Desktop", "Total frames:", totalFrames, "Start path:", getFramePath(1));
    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        loadedCount++;
        updateProgress();
        // Redraw current frame to swap low-res or blank fallbacks with the high-res file
        if (!isAnimating && hasStarted) {
          drawFrame(Math.round(currentFrameIndex), true);
        }
      };
      img.onerror = () => {
        console.error(`Failed to load frame: ${img.src}`);
        // Increment anyway to prevent preloader from getting stuck
        loadedCount++;
        updateProgress();
        if (!isAnimating && hasStarted) {
          drawFrame(Math.round(currentFrameIndex), true);
        }
      };
      images.push(img);
    }
  }

  // Update visual progress of preloading
  function updateProgress() {
    const minFramesToStart = Math.min(25, totalFrames); // Start once 25 frames are loaded
    const percentage = Math.round((loadedCount / totalFrames) * 100);
    progressBar.style.width = `${percentage}%`;
    progressText.innerText = `${percentage}%`;

    // Start experience early once critical frames are loaded, to eliminate user wait delays
    if (!hasStarted && loadedCount >= minFramesToStart && images[0] && images[0].complete) {
      hasStarted = true;
      setTimeout(startExperience, 400);
    }
  }

  // Transition from preloader to the experience
  function startExperience() {
    preloader.classList.add('fade-out');
    document.body.style.overflow = 'auto'; // Re-enable scroll
    
    // Prevent layout shift on mobile toolbars height resize: Lock sticky container height to absolute pixels
    if (isMobile) {
      const stickyContainer = document.querySelector('.sticky-container');
      if (stickyContainer) {
        stickyContainer.style.height = `${window.innerHeight}px`;
      }
    }

    // Initial draw and canvas sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial scroll check
    handleScroll();

    // WebKit GPU/Layout settled redraw: ensure the first frame is painted even if Safari's first context paint skipped
    setTimeout(() => {
      drawFrame(1, true);
    }, 100);
  }

  // Handle aspect-ratio cover layout on Canvas (object-fit: cover behavior)
  function drawFrame(index, forceRedraw = false) {
    if (!forceRedraw && index === lastDrawnIndex) return; // Prevent redundant draws
    
    // Find closest loaded image if the requested one is not complete
    let isFallback = false;
    let img = images[index - 1];
    if (!img || !img.complete || img.naturalWidth === 0) {
      let found = false;
      for (let offset = 1; offset < totalFrames; offset++) {
        const prevIdx = index - 1 - offset;
        const nextIdx = index - 1 + offset;
        
        if (prevIdx >= 0 && images[prevIdx] && images[prevIdx].complete && images[prevIdx].naturalWidth > 0) {
          img = images[prevIdx];
          found = true;
          isFallback = true;
          break;
        }
        if (nextIdx < totalFrames && images[nextIdx] && images[nextIdx].complete && images[nextIdx].naturalWidth > 0) {
          img = images[nextIdx];
          found = true;
          isFallback = true;
          break;
        }
      }
      if (!found) return; // No frames loaded at all
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Clear and draw
    ctx.clearRect(0, 0, cw, ch);

    // Calculate scaling: desktop uses cover (fill), mobile uses contain (fit) to preserve full framing
    let scale;
    if (isMobile) {
      scale = Math.min(cw / iw, ch / ih);
      if (scale > 1) {
        scale = 1; // Do not scale the images beyond their native resolution
      }
    } else {
      scale = Math.max(cw / iw, ch / ih);
    }
    
    const sw = iw * scale;
    const sh = ih * scale;
    const x = (cw - sw) / 2;
    const y = (ch - sh) / 2;

    ctx.drawImage(img, x, y, sw, sh);
    
    // Only cache lastDrawnIndex if we drew the actual requested frame (not a fallback!)
    if (!isFallback) {
      lastDrawnIndex = index;
    } else {
      lastDrawnIndex = -1;
    }
  }

  // Dynamic canvas sizing matching window dimensions and pixel ratio
  let lastWidth = 0;
  let lastHeight = 0;

  function resizeCanvas() {
    const widthChanged = window.innerWidth !== lastWidth;
    const heightChanged = window.innerHeight !== lastHeight;

    // Ignore height changes caused by collapsible toolbar on mobile scrolling
    if (isMobile && !widthChanged && Math.abs(window.innerHeight - lastHeight) < 120) {
      return;
    }

    lastWidth = window.innerWidth;
    lastHeight = window.innerHeight;

    // Desktop and Mobile: Size canvas based on window dimensions and device pixel ratio
    const scale = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    
    drawFrame(Math.round(currentFrameIndex));
  }

  // Track scroll and drive animation/content states
  let ticking = false;
  function handleScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateScrollState();
        ticking = false;
      });
      ticking = true;
    }
  }

  function updateScrollState() {
    const scrollY = window.scrollY;
    const trackHeight = scrollTrack.offsetHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = trackHeight - viewportHeight;

    if (maxScroll <= 0) return;

    // Normalize scroll position to a 0.0 - 1.0 fraction
    const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));

    // Mapping:
    // 0.0 to 0.65: Scrub the animation sequence frames 1 to 102
    // 0.65 to 0.75: Pin the last frame (frame 102) for a brief moment
    // 0.75 to 1.00: Reveal the premium hero content with elegant motion
    
    const ANIMATION_END = 0.65;
    const PIN_END = 0.75;

    let targetFrame = 1;

    if (scrollFraction <= ANIMATION_END) {
      // Map scroll progress to frame index
      const animProgress = scrollFraction / ANIMATION_END;
      targetFrame = Math.floor(animProgress * (totalFrames - 1)) + 1;
    } else {
      // Pin the final frame
      targetFrame = totalFrames;
    }

    targetFrameIndex = Math.max(1, Math.min(totalFrames, targetFrame));
    
    // Start smooth rendering loop if not running
    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(renderLoop);
    }

    // Reveal / hide content based on threshold
    if (scrollFraction >= PIN_END) {
      heroContent.classList.add('reveal-active');
      scrollIndicator.classList.add('hide'); // Hide standard bottom indicator as we reached the content
    } else {
      heroContent.classList.remove('reveal-active');
      
      // If we are at the very top, show indicator; otherwise hide it during active scrubbing
      if (scrollY < 50) {
        scrollIndicator.classList.remove('hide');
      } else {
        scrollIndicator.classList.add('hide');
      }
    }

    // Toggle glassmorphic navbar styling on scroll
    if (scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  // Linear interpolation loop to smooth out mouse wheel increments
  function renderLoop() {
    const diff = targetFrameIndex - currentFrameIndex;

    // If close enough, snap to target and stop animation loop
    if (Math.abs(diff) < 0.01) {
      currentFrameIndex = targetFrameIndex;
      drawFrame(Math.round(currentFrameIndex));
      isAnimating = false;
    } else {
      // Smoothly slide towards the target frame index (speed factor 0.12)
      currentFrameIndex += diff * 0.12;
      drawFrame(Math.round(currentFrameIndex));
      requestAnimationFrame(renderLoop);
    }
  }

  // Intersection Observer for scroll-revealed elements (About section)
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal-element');
    const observerOptions = {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target); // Stop tracking once revealed
        }
      });
    }, observerOptions);

    revealElements.forEach(el => observer.observe(el));
  }

  // Mobile drawer navigation logic
  function initMobileDrawer() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileDrawer = document.querySelector('.mobile-drawer');

    if (menuToggle && mobileDrawer) {
      menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        mobileDrawer.classList.toggle('open');
        document.body.classList.toggle('drawer-open');
      });

      const drawerLinks = document.querySelectorAll('.drawer-item');
      drawerLinks.forEach(link => {
        link.addEventListener('click', () => {
          menuToggle.classList.remove('active');
          mobileDrawer.classList.remove('open');
          document.body.classList.remove('drawer-open');
        });
      });
    }
  }

  // Initialize Lightbox Modal for Gallery
  function initLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');

    if (!lightbox || !lightboxImg) return;

    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        const src = item.getAttribute('data-src');
        const caption = item.getAttribute('data-caption');
        
        lightboxImg.src = src;
        lightboxCaption.textContent = caption || '';
        
        lightbox.classList.add('open');
        document.body.classList.add('drawer-open'); // Prevent background scrolling
      });
    });

    // Close lightbox on clicking outside container or close button
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
        lightbox.classList.remove('open');
        document.body.classList.remove('drawer-open');
      }
    });

    // Escape key press closes lightbox
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) {
        lightbox.classList.remove('open');
        document.body.classList.remove('drawer-open');
      }
    });
  }

  // Trigger initializations
  preloadImages();
  initScrollReveal();
  initMobileDrawer();
  initLightbox();
});
