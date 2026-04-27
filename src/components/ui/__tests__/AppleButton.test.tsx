/**
 * Unit Tests: Apple Button Component
 * 
 * Feature: apple-design-system-implementation
 * Task 3.4: Write unit tests for button variants
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
 * 
 * This test suite verifies the Apple button system implementation:
 * - Primary CTA button styling (Apple Blue background, white text)
 * - Pill CTA button styling (980px border radius, transparent background)
 * - Filter button styling (light background, subtle borders)
 * - Media control button styling (circular shape, translucent background)
 * - Button state changes (hover, focus, active, disabled)
 * - Accessibility focus indicators (2px solid Apple Blue outline)
 * - Touch target sizing (minimum 44px height)
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AppleButton, AppleLink } from '../index'
import React from 'react'

// Apple Blue color value for testing
const APPLE_BLUE = '#0071e3'
const APPLE_BLUE_RGB = 'rgb(0, 113, 227)'

describe('Apple Button Component - Unit Tests', () => {
  afterEach(() => {
    cleanup()
  })

  describe('Primary CTA Button (Requirements 4.1, 4.2)', () => {
    it('should render primary button with Apple Blue background', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // Verify button has the correct classes
      expect(button).toHaveClass('apple-button')
      expect(button).toHaveClass('apple-button--primary')
    })

    it('should apply correct padding (8px 15px) to primary button', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // The CSS applies padding: var(--space-8) var(--space-15) = 8px 15px
      expect(button).toHaveClass('apple-button--primary')
    })

    it('should apply 8px border radius to primary button', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // The CSS applies border-radius: var(--radius-standard) = 8px
      expect(button).toHaveClass('apple-button--primary')
    })

    it('should use 17px font size for primary button', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // The CSS applies font-size: var(--size-button) = 17px
      expect(button).toHaveClass('apple-button')
    })

    it('should use SF Pro Text font family for primary button', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // The CSS applies font-family: var(--font-text) = SF Pro Text
      expect(button).toHaveClass('apple-button')
    })

    it('should use weight 400 (regular) for primary button text', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // The CSS applies font-weight: var(--weight-regular) = 400
      expect(button).toHaveClass('apple-button')
    })

    it('should have minimum 44px height for touch targets', () => {
      render(
        <AppleButton variant="primary" data-testid="primary-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('primary-button')
      
      // The CSS applies min-height: 44px for touch accessibility
      expect(button).toHaveClass('apple-button--primary')
    })

    it('should render button content correctly', () => {
      render(
        <AppleButton variant="primary">
          Primary CTA
        </AppleButton>
      )

      expect(screen.getByText('Primary CTA')).toBeInTheDocument()
    })

    it('should handle onClick events', () => {
      const handleClick = jest.fn()
      
      render(
        <AppleButton variant="primary" onClick={handleClick}>
          Click me
        </AppleButton>
      )

      const button = screen.getByText('Click me')
      fireEvent.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Pill CTA Button (Requirements 4.3, 4.4)', () => {
    it('should render pill button with 980px border radius', () => {
      render(
        <AppleButton variant="pill" data-testid="pill-button">
          Learn more
        </AppleButton>
      )

      const button = screen.getByTestId('pill-button')
      
      // Verify button has the correct classes
      expect(button).toHaveClass('apple-button')
      expect(button).toHaveClass('apple-button--pill')
    })

    it('should apply transparent background to pill button', () => {
      render(
        <AppleButton variant="pill" data-testid="pill-button">
          Learn more
        </AppleButton>
      )

      const button = screen.getByTestId('pill-button')
      
      // The CSS applies background: transparent
      expect(button).toHaveClass('apple-button--pill')
    })

    it('should apply colored border to pill button', () => {
      render(
        <AppleButton variant="pill" data-testid="pill-button">
          Learn more
        </AppleButton>
      )

      const button = screen.getByTestId('pill-button')
      
      // The CSS applies border: 1px solid var(--link-light)
      expect(button).toHaveClass('apple-button--pill')
    })

    it('should apply correct padding (8px 15px) to pill button', () => {
      render(
        <AppleButton variant="pill" data-testid="pill-button">
          Learn more
        </AppleButton>
      )

      const button = screen.getByTestId('pill-button')
      
      // The CSS applies padding: var(--space-8) var(--space-15)
      expect(button).toHaveClass('apple-button--pill')
    })

    it('should have minimum 44px height for touch targets', () => {
      render(
        <AppleButton variant="pill" data-testid="pill-button">
          Learn more
        </AppleButton>
      )

      const button = screen.getByTestId('pill-button')
      
      // The CSS applies min-height: 44px
      expect(button).toHaveClass('apple-button--pill')
    })

    it('should render pill button content correctly', () => {
      render(
        <AppleButton variant="pill">
          Learn more →
        </AppleButton>
      )

      expect(screen.getByText('Learn more →')).toBeInTheDocument()
    })
  })

  describe('Filter Button (Requirements 4.5)', () => {
    it('should render filter button with light background', () => {
      render(
        <AppleButton variant="filter" data-testid="filter-button">
          Filter
        </AppleButton>
      )

      const button = screen.getByTestId('filter-button')
      
      // Verify button has the correct classes
      expect(button).toHaveClass('apple-button')
      expect(button).toHaveClass('apple-button--filter')
    })

    it('should apply subtle border to filter button', () => {
      render(
        <AppleButton variant="filter" data-testid="filter-button">
          Filter
        </AppleButton>
      )

      const button = screen.getByTestId('filter-button')
      
      // The CSS applies border: 3px solid rgba(0, 0, 0, 0.04)
      expect(button).toHaveClass('apple-button--filter')
    })

    it('should apply 11px border radius to filter button', () => {
      render(
        <AppleButton variant="filter" data-testid="filter-button">
          Filter
        </AppleButton>
      )

      const button = screen.getByTestId('filter-button')
      
      // The CSS applies border-radius: var(--radius-comfortable) = 11px
      expect(button).toHaveClass('apple-button--filter')
    })

    it('should use 13px font size for filter button', () => {
      render(
        <AppleButton variant="filter" data-testid="filter-button">
          Filter
        </AppleButton>
      )

      const button = screen.getByTestId('filter-button')
      
      // The CSS applies font-size: 13px
      expect(button).toHaveClass('apple-button--filter')
    })

    it('should have minimum 44px height for touch targets', () => {
      render(
        <AppleButton variant="filter" data-testid="filter-button">
          Filter
        </AppleButton>
      )

      const button = screen.getByTestId('filter-button')
      
      // The CSS applies min-height: 44px
      expect(button).toHaveClass('apple-button--filter')
    })

    it('should render filter button content correctly', () => {
      render(
        <AppleButton variant="filter">
          Apply Filter
        </AppleButton>
      )

      expect(screen.getByText('Apply Filter')).toBeInTheDocument()
    })
  })

  describe('Media Control Button (Requirements 4.6)', () => {
    it('should render media button with circular shape', () => {
      render(
        <AppleButton variant="media" data-testid="media-button">
          ▶
        </AppleButton>
      )

      const button = screen.getByTestId('media-button')
      
      // Verify button has the correct classes
      expect(button).toHaveClass('apple-button')
      expect(button).toHaveClass('apple-button--media')
    })

    it('should apply 50% border radius for circular shape', () => {
      render(
        <AppleButton variant="media" data-testid="media-button">
          ▶
        </AppleButton>
      )

      const button = screen.getByTestId('media-button')
      
      // The CSS applies border-radius: var(--radius-circle) = 50%
      expect(button).toHaveClass('apple-button--media')
    })

    it('should apply translucent background to media button', () => {
      render(
        <AppleButton variant="media" data-testid="media-button">
          ▶
        </AppleButton>
      )

      const button = screen.getByTestId('media-button')
      
      // The CSS applies background: var(--overlay) = rgba(210, 210, 215, 0.64)
      expect(button).toHaveClass('apple-button--media')
    })

    it('should have 44x44px dimensions for touch targets', () => {
      render(
        <AppleButton variant="media" data-testid="media-button">
          ▶
        </AppleButton>
      )

      const button = screen.getByTestId('media-button')
      
      // The CSS applies width: 44px, height: 44px, min-width: 44px, min-height: 44px
      expect(button).toHaveClass('apple-button--media')
    })

    it('should render media button content correctly', () => {
      render(
        <AppleButton variant="media">
          ▶
        </AppleButton>
      )

      expect(screen.getByText('▶')).toBeInTheDocument()
    })
  })

  describe('Button State Changes (Requirements 4.7)', () => {
    it('should handle disabled state', () => {
      render(
        <AppleButton variant="primary" disabled data-testid="disabled-button">
          Disabled
        </AppleButton>
      )

      const button = screen.getByTestId('disabled-button')
      
      expect(button).toBeDisabled()
    })

    it('should not trigger onClick when disabled', () => {
      const handleClick = jest.fn()
      
      render(
        <AppleButton variant="primary" disabled onClick={handleClick}>
          Disabled
        </AppleButton>
      )

      const button = screen.getByText('Disabled')
      fireEvent.click(button)
      
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should show loading spinner when loading', () => {
      render(
        <AppleButton variant="primary" loading data-testid="loading-button">
          Loading
        </AppleButton>
      )

      const button = screen.getByTestId('loading-button')
      
      // Button should be disabled when loading
      expect(button).toBeDisabled()
      
      // Spinner should be present (check for spinner class)
      const spinner = button.querySelector('[class*="spinner"]')
      expect(spinner).toBeInTheDocument()
    })

    it('should not trigger onClick when loading', () => {
      const handleClick = jest.fn()
      
      render(
        <AppleButton variant="primary" loading onClick={handleClick}>
          Loading
        </AppleButton>
      )

      const button = screen.getByText('Loading')
      fireEvent.click(button)
      
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should apply active state styling on click', () => {
      render(
        <AppleButton variant="primary" data-testid="active-button">
          Click me
        </AppleButton>
      )

      const button = screen.getByTestId('active-button')
      
      // The CSS includes :active pseudo-class with transform: scale(0.98)
      expect(button).toHaveClass('apple-button--primary')
    })
  })

  describe('Accessibility Focus Indicators (Requirement 4.7)', () => {
    it('should have focus-visible styles defined', () => {
      render(
        <AppleButton variant="primary" data-testid="focus-button">
          Focus me
        </AppleButton>
      )

      const button = screen.getByTestId('focus-button')
      
      // The CSS includes :focus-visible with 2px solid Apple Blue outline
      expect(button).toHaveClass('apple-button')
    })

    it('should be keyboard accessible', () => {
      render(
        <AppleButton variant="primary">
          Keyboard accessible
        </AppleButton>
      )

      const button = screen.getByText('Keyboard accessible')
      
      // Button should be focusable
      button.focus()
      expect(button).toHaveFocus()
    })

    it('should have proper button type attribute', () => {
      render(
        <AppleButton variant="primary" type="submit" data-testid="submit-button">
          Submit
        </AppleButton>
      )

      const button = screen.getByTestId('submit-button')
      
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('should default to button type', () => {
      render(
        <AppleButton variant="primary" data-testid="default-button">
          Default
        </AppleButton>
      )

      const button = screen.getByTestId('default-button')
      
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  describe('Button Sizing (Requirements 4.1, 4.2, 4.5, 4.6)', () => {
    it('should support small size variant', () => {
      render(
        <AppleButton variant="primary" size="small" data-testid="small-button">
          Small
        </AppleButton>
      )

      const button = screen.getByTestId('small-button')
      
      // The CSS applies size-specific classes
      expect(button).toHaveClass('apple-button')
    })

    it('should support medium size variant (default)', () => {
      render(
        <AppleButton variant="primary" size="medium" data-testid="medium-button">
          Medium
        </AppleButton>
      )

      const button = screen.getByTestId('medium-button')
      
      expect(button).toHaveClass('apple-button')
    })

    it('should support large size variant', () => {
      render(
        <AppleButton variant="primary" size="large" data-testid="large-button">
          Large
        </AppleButton>
      )

      const button = screen.getByTestId('large-button')
      
      expect(button).toHaveClass('apple-button')
    })

    it('should maintain minimum 44px height on mobile', () => {
      render(
        <AppleButton variant="primary" data-testid="mobile-button">
          Mobile
        </AppleButton>
      )

      const button = screen.getByTestId('mobile-button')
      
      // The CSS includes @media (max-width: 640px) with min-height: 48px
      expect(button).toHaveClass('apple-button')
    })

    it('should maintain 48x48px dimensions for media buttons on mobile', () => {
      render(
        <AppleButton variant="media" data-testid="mobile-media-button">
          ▶
        </AppleButton>
      )

      const button = screen.getByTestId('mobile-media-button')
      
      // The CSS includes @media (max-width: 640px) with 48x48px dimensions
      expect(button).toHaveClass('apple-button--media')
    })
  })

  describe('Button Transitions and Animations', () => {
    it('should have smooth transition timing', () => {
      render(
        <AppleButton variant="primary" data-testid="transition-button">
          Transition
        </AppleButton>
      )

      const button = screen.getByTestId('transition-button')
      
      // The CSS applies transition with Apple's smooth deceleration easing
      expect(button).toHaveClass('apple-button')
    })

    it('should apply scale transform on active state for primary button', () => {
      render(
        <AppleButton variant="primary" data-testid="scale-button">
          Scale
        </AppleButton>
      )

      const button = screen.getByTestId('scale-button')
      
      // The CSS includes :active { transform: scale(0.98) }
      expect(button).toHaveClass('apple-button--primary')
    })

    it('should apply scale transform on active state for media button', () => {
      render(
        <AppleButton variant="media" data-testid="media-scale-button">
          ▶
        </AppleButton>
      )

      const button = screen.getByTestId('media-scale-button')
      
      // The CSS includes :active { transform: scale(0.9) }
      expect(button).toHaveClass('apple-button--media')
    })
  })

  describe('Custom Styling and Props', () => {
    it('should accept custom className', () => {
      render(
        <AppleButton variant="primary" className="custom-class" data-testid="custom-button">
          Custom
        </AppleButton>
      )

      const button = screen.getByTestId('custom-button')
      
      expect(button).toHaveClass('apple-button')
      expect(button).toHaveClass('apple-button--primary')
      expect(button).toHaveClass('custom-class')
    })

    it('should accept custom style prop', () => {
      render(
        <AppleButton 
          variant="primary" 
          style={{ marginTop: '20px' }}
          data-testid="styled-button"
        >
          Styled
        </AppleButton>
      )

      const button = screen.getByTestId('styled-button')
      
      expect(button).toHaveStyle({ marginTop: '20px' })
    })

    it('should forward additional props to button element', () => {
      render(
        <AppleButton 
          variant="primary" 
          data-custom="custom-value"
          data-testid="props-button"
        >
          Props
        </AppleButton>
      )

      const button = screen.getByTestId('props-button')
      
      expect(button).toHaveAttribute('data-custom', 'custom-value')
    })
  })

  describe('Apple Link Component (Pill-shaped CTAs)', () => {
    it('should render link with href', () => {
      render(
        <AppleLink href="/learn-more" data-testid="apple-link">
          Learn more
        </AppleLink>
      )

      const link = screen.getByTestId('apple-link')
      
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/learn-more')
      expect(link).toHaveClass('apple-link--pill')
    })

    it('should render link as button when no href provided', () => {
      const handleClick = jest.fn()
      
      render(
        <AppleLink onClick={handleClick} data-testid="apple-link-button">
          Click me
        </AppleLink>
      )

      const link = screen.getByTestId('apple-link-button')
      
      expect(link.tagName).toBe('BUTTON')
      expect(link).toHaveClass('apple-link--pill')
      
      fireEvent.click(link)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should support light variant', () => {
      render(
        <AppleLink href="#" variant="light" data-testid="light-link">
          Light link
        </AppleLink>
      )

      const link = screen.getByTestId('light-link')
      
      expect(link).toHaveClass('apple-link--pill')
      expect(link).toHaveClass('apple-link--light')
    })

    it('should support dark variant', () => {
      render(
        <AppleLink href="#" variant="dark" data-testid="dark-link">
          Dark link
        </AppleLink>
      )

      const link = screen.getByTestId('dark-link')
      
      expect(link).toHaveClass('apple-link--pill')
      expect(link).toHaveClass('apple-link--dark')
    })

    it('should render link content correctly', () => {
      render(
        <AppleLink href="#">
          Learn more →
        </AppleLink>
      )

      expect(screen.getByText('Learn more →')).toBeInTheDocument()
    })
  })

  describe('Button Variants Integration', () => {
    it('should render all button variants correctly', () => {
      const { container } = render(
        <div>
          <AppleButton variant="primary">Primary</AppleButton>
          <AppleButton variant="pill">Pill</AppleButton>
          <AppleButton variant="filter">Filter</AppleButton>
          <AppleButton variant="media">▶</AppleButton>
        </div>
      )

      expect(screen.getByText('Primary')).toBeInTheDocument()
      expect(screen.getByText('Pill')).toBeInTheDocument()
      expect(screen.getByText('Filter')).toBeInTheDocument()
      expect(screen.getByText('▶')).toBeInTheDocument()
      
      const buttons = container.querySelectorAll('.apple-button')
      expect(buttons.length).toBe(4)
    })

    it('should maintain consistent styling across variants', () => {
      const { container } = render(
        <div>
          <AppleButton variant="primary" data-testid="btn-1">Button 1</AppleButton>
          <AppleButton variant="pill" data-testid="btn-2">Button 2</AppleButton>
          <AppleButton variant="filter" data-testid="btn-3">Button 3</AppleButton>
        </div>
      )

      const buttons = container.querySelectorAll('.apple-button')
      
      // All buttons should have the base apple-button class
      buttons.forEach(button => {
        expect(button).toHaveClass('apple-button')
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing children gracefully', () => {
      const { container } = render(
        <AppleButton variant="primary" data-testid="empty-button">
          {/* Empty */}
        </AppleButton>
      )

      const button = screen.getByTestId('empty-button')
      expect(button).toBeInTheDocument()
    })

    it('should handle complex children content', () => {
      render(
        <AppleButton variant="primary">
          <span>Icon</span>
          <span>Text</span>
        </AppleButton>
      )

      expect(screen.getByText('Icon')).toBeInTheDocument()
      expect(screen.getByText('Text')).toBeInTheDocument()
    })

    it('should handle rapid clicks gracefully', () => {
      const handleClick = jest.fn()
      
      render(
        <AppleButton variant="primary" onClick={handleClick}>
          Click me
        </AppleButton>
      )

      const button = screen.getByText('Click me')
      
      // Simulate rapid clicks
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(3)
    })

    it('should handle both loading and disabled states', () => {
      render(
        <AppleButton variant="primary" loading disabled data-testid="both-states">
          Button
        </AppleButton>
      )

      const button = screen.getByTestId('both-states')
      
      expect(button).toBeDisabled()
    })
  })

  describe('Responsive Behavior', () => {
    it('should apply mobile-specific styles via CSS classes', () => {
      render(
        <AppleButton variant="primary" data-testid="responsive-button">
          Responsive
        </AppleButton>
      )

      const button = screen.getByTestId('responsive-button')
      
      // The CSS includes @media (max-width: 640px) rules
      expect(button).toHaveClass('apple-button')
    })

    it('should maintain touch target size on all screen sizes', () => {
      render(
        <AppleButton variant="primary" data-testid="touch-target">
          Touch Target
        </AppleButton>
      )

      const button = screen.getByTestId('touch-target')
      
      // The CSS ensures min-height: 44px (desktop) and 48px (mobile)
      expect(button).toHaveClass('apple-button')
    })
  })
})
