<?php
/**
 * Plugin Name: AunoForge Clean Fixture
 */
function aunoforge_safe_output() {
    echo esc_html( sanitize_text_field( wp_unslash( $_GET['name'] ?? '' ) ) );
}
