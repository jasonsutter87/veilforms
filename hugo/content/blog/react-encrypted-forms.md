---
title: "Adding Encrypted Forms to Your React App"
description: "Step-by-step tutorial for integrating VeilForms with React. Build privacy-first forms with client-side encryption in your React application."
priority: 0.6
date: 2025-11-22
category: "Tutorial"
author: "VeilForms Team"
readTime: 8
tags: ["react", "tutorial", "javascript", "integration"]
type: "blog"
css: ["blog.css"]
---

Building forms in React? Here's how to add client-side encryption to protect your users' data before it leaves their browser.

## Prerequisites

- React 18+ project
- VeilForms account (free tier works)
- Form ID and public key from dashboard

## Installation

Install the VeilForms SDK:

```bash
npm install @veilforms/react
```

Or use the CDN in your HTML:

```html
<script src="https://cdn.veilforms.com/v1/veilforms.esm.js"></script>
```

## Basic Setup

### Option 1: React Hook

```jsx
import { useVeilForm } from '@veilforms/react';

function ContactForm() {
  const { submit, isSubmitting, error, success } = useVeilForm({
    formId: 'your-form-id',
    publicKey: 'your-public-key'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await submit(Object.fromEntries(formData));
  };

  if (success) {
    return <div className="success">Thank you! Your message has been sent securely.</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input type="text" id="name" name="name" required />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input type="email" id="email" name="email" required />
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" rows={4} required />
      </div>

      {error && <div className="error">{error.message}</div>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Securely'}
      </button>
    </form>
  );
}
```

### Option 2: Data Attribute

Add the attribute to any existing form:

```jsx
function ContactForm() {
  return (
    <form data-veilform="your-form-id">
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <textarea name="message" required />
      <button type="submit">Send</button>
    </form>
  );
}
```

Initialize in your app entry point:

```jsx
// App.jsx or index.jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Initialize VeilForms after component mounts
    if (window.VeilForms) {
      window.VeilForms.init({
        publicKey: 'your-public-key'
      });
    }
  }, []);

  return <ContactForm />;
}
```

## Advanced Configuration

### With TypeScript

```tsx
import { useVeilForm, VeilFormConfig, SubmissionResult } from '@veilforms/react';

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

function ContactForm() {
  const config: VeilFormConfig = {
    formId: 'contact',
    publicKey: process.env.REACT_APP_VEILFORMS_KEY!,
    onSuccess: (result: SubmissionResult) => {
      console.log('Submission ID:', result.submissionId);
    },
    onError: (error: Error) => {
      console.error('Submission failed:', error);
    }
  };

  const { submit, isSubmitting } = useVeilForm<ContactFormData>(config);

  const handleSubmit = async (data: ContactFormData) => {
    await submit(data);
  };

  // ... form JSX
}
```

### With React Hook Form

```jsx
import { useForm } from 'react-hook-form';
import { useVeilForm } from '@veilforms/react';

function ContactForm() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { submit, isSubmitting } = useVeilForm({
    formId: 'contact',
    publicKey: 'your-public-key'
  });

  const onSubmit = async (data) => {
    await submit(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('name', { required: 'Name is required' })}
        placeholder="Name"
      />
      {errors.name && <span>{errors.name.message}</span>}

      <input
        {...register('email', {
          required: 'Email is required',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Invalid email address'
          }
        })}
        placeholder="Email"
      />
      {errors.email && <span>{errors.email.message}</span>}

      <textarea
        {...register('message', { required: 'Message is required' })}
        placeholder="Message"
      />
      {errors.message && <span>{errors.message.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

### With Formik

```jsx
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useVeilForm } from '@veilforms/react';

const validationSchema = Yup.object({
  name: Yup.string().required('Required'),
  email: Yup.string().email('Invalid email').required('Required'),
  message: Yup.string().required('Required')
});

function ContactForm() {
  const { submit } = useVeilForm({
    formId: 'contact',
    publicKey: 'your-public-key'
  });

  return (
    <Formik
      initialValues={{ name: '', email: '', message: '' }}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        await submit(values);
        setSubmitting(false);
        resetForm();
      }}
    >
      {({ isSubmitting }) => (
        <Form>
          <Field type="text" name="name" placeholder="Name" />
          <ErrorMessage name="name" component="div" className="error" />

          <Field type="email" name="email" placeholder="Email" />
          <ErrorMessage name="email" component="div" className="error" />

          <Field as="textarea" name="message" placeholder="Message" />
          <ErrorMessage name="message" component="div" className="error" />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </Form>
      )}
    </Formik>
  );
}
```

## Handling PII Detection

Enable PII detection to identify sensitive data:

```jsx
const { submit } = useVeilForm({
  formId: 'feedback',
  publicKey: 'your-public-key',
  piiDetection: {
    enabled: true,
    types: ['email', 'phone', 'ssn', 'creditCard'],
    onDetect: (detected) => {
      console.log('PII detected:', detected);
      // Show warning to user if needed
    }
  }
});
```

## Custom Success/Error Handling

```jsx
function ContactForm() {
  const [status, setStatus] = useState(null);

  const { submit, isSubmitting } = useVeilForm({
    formId: 'contact',
    publicKey: 'your-public-key',
    onSuccess: (result) => {
      setStatus({
        type: 'success',
        message: 'Message sent! ID: ' + result.submissionId
      });
    },
    onError: (error) => {
      setStatus({
        type: 'error',
        message: error.message || 'Something went wrong'
      });
    }
  });

  return (
    <div>
      {status && (
        <div className={`alert ${status.type}`}>
          {status.message}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* form fields */}
      </form>
    </div>
  );
}
```

## Environment Variables

Store your public key in environment variables:

```bash
# .env
REACT_APP_VEILFORMS_KEY=your-public-key
REACT_APP_VEILFORMS_FORM_ID=contact
```

```jsx
const { submit } = useVeilForm({
  formId: process.env.REACT_APP_VEILFORMS_FORM_ID,
  publicKey: process.env.REACT_APP_VEILFORMS_KEY
});
```

## Complete Example

Here's a full contact form component with styling:

```jsx
import { useState } from 'react';
import { useVeilForm } from '@veilforms/react';
import './ContactForm.css';

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const { submit, isSubmitting, error, success, reset } = useVeilForm({
    formId: process.env.REACT_APP_VEILFORMS_FORM_ID,
    publicKey: process.env.REACT_APP_VEILFORMS_KEY
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submit(formData);
  };

  if (success) {
    return (
      <div className="contact-success">
        <h3>Message Sent!</h3>
        <p>Your message has been encrypted and sent securely.</p>
        <button onClick={() => {
          reset();
          setFormData({ name: '', email: '', subject: '', message: '' });
        }}>
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="subject">Subject</label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Message *</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={formData.message}
          onChange={handleChange}
          required
        />
      </div>

      {error && (
        <div className="form-error">
          {error.message}
        </div>
      )}

      <div className="form-footer">
        <p className="security-note">
          Your data is encrypted in your browser before transmission.
        </p>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Encrypting & Sending...' : 'Send Securely'}
        </button>
      </div>
    </form>
  );
}
```

---

That's it! Your React forms now encrypt data in the browser before submission. Users get the same form experience, but with military-grade encryption protecting their data.

Questions? Check out the [full SDK documentation](/docs/sdk/installation/) or [contact us](/contact/).
