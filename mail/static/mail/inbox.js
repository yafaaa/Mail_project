document.addEventListener('DOMContentLoaded', function() {

  // Use buttons to toggle between views
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);

  // Add event listener for compose form submission
  document.querySelector('#compose-form').addEventListener('submit', send_email);

  // By default, load the inbox
  load_mailbox('inbox');
});

function compose_email() {

  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  // Clear out composition fields
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';
}

function load_mailbox(mailbox) {
  
  // Show the mailbox and hide other views
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#compose-view').style.display = 'none';

  // Show the mailbox name and add a loading indicator
  document.querySelector('#emails-view').innerHTML = `
    <h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>
    <div id="loading-indicator">Loading emails...</div>
  `;

  // Make a GET request to get the latest emails for the mailbox
  fetch(`/emails/${mailbox}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(emails => {
      // Remove loading indicator
      document.getElementById('loading-indicator').remove();
      
      // Print emails to console for debugging
      console.log(emails);

      // If no emails, display a message
      if (emails.length === 0) {
        const noEmailsMsg = document.createElement('div');
        noEmailsMsg.className = 'no-emails-message';
        noEmailsMsg.textContent = `No emails in ${mailbox}.`;
        document.querySelector('#emails-view').append(noEmailsMsg);
        return;
      }

      // Create a container for emails
      const emailsContainer = document.createElement('div');
      emailsContainer.className = 'emails-container';
      
      // Display each email
      emails.forEach(email => {
        const emailElement = document.createElement('div');
        
        // Add classes for styling
        emailElement.className = email.read ? 'email read' : 'email unread';
        
        // Add email details
        emailElement.innerHTML = `
          <div class="email-sender"><strong>${email.sender}</strong></div>
          <div class="email-subject">${email.subject}</div>
          <div class="email-timestamp">${email.timestamp}</div>
        `;
        
        // Add click event to view email
        emailElement.addEventListener('click', () => view_email(email.id, mailbox));
        
        // Add to container
        emailsContainer.append(emailElement);
      });
      
      // Add container to page
      document.querySelector('#emails-view').append(emailsContainer);
    })
    .catch(error => {
      console.error('Error fetching emails:', error);
      document.querySelector('#emails-view').innerHTML = `
        <h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>
        <div class="error-message">Error loading emails. Please try again.</div>
      `;
    });
}

function view_email(email_id, mailbox) {
  // Show the emails view and hide compose view
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#compose-view').style.display = 'none';
  
  // Clear out the emails view
  document.querySelector('#emails-view').innerHTML = '<div id="loading-indicator">Loading email...</div>';
  
  // Fetch the email
  fetch(`/emails/${email_id}`)
    .then(response => response.json())
    .then(email => {
      // Create view for email
      document.querySelector('#emails-view').innerHTML = `
        <div class="email-detail">
          <div><strong>From:</strong> ${email.sender}</div>
          <div><strong>To:</strong> ${email.recipients.join(', ')}</div>
          <div><strong>Subject:</strong> ${email.subject}</div>
          <div><strong>Timestamp:</strong> ${email.timestamp}</div>
          <hr>
          <div class="email-body">${email.body}</div>
        </div>
        <div class="email-actions">
          <button class="btn btn-sm btn-outline-primary" id="back-button">Back to ${mailbox}</button>
          ${mailbox === 'inbox' ? `<button class="btn btn-sm btn-outline-primary" id="archive-button">Archive</button>` : ''}
          ${mailbox === 'archive' ? `<button class="btn btn-sm btn-outline-primary" id="unarchive-button">Unarchive</button>` : ''}
          <button class="btn btn-sm btn-outline-primary" id="reply-button">Reply</button>
        </div>
      `;
      
      // Mark email as read if it isn't already
      if (!email.read) {
        fetch(`/emails/${email_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            read: true
          })
        });
      }
      
      // Add event listener for back button
      document.querySelector('#back-button').addEventListener('click', () => load_mailbox(mailbox));
      
      // Add event listener for reply button
      document.querySelector('#reply-button').addEventListener('click', () => reply_to_email(email));
      
      // Add event listeners for archive/unarchive buttons if present
      if (mailbox === 'inbox') {
        document.querySelector('#archive-button').addEventListener('click', () => {
          fetch(`/emails/${email_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              archived: true
            })
          })
          .then(() => load_mailbox('inbox'));
        });
      } else if (mailbox === 'archive') {
        document.querySelector('#unarchive-button').addEventListener('click', () => {
          fetch(`/emails/${email_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              archived: false
            })
          })
          .then(() => load_mailbox('inbox'));
        });
      }
    })
    .catch(error => {
      console.error('Error viewing email:', error);
      document.querySelector('#emails-view').innerHTML = `
        <div class="error-message">Error loading email. Please try again.</div>
        <button class="btn btn-sm btn-outline-primary" id="back-button">Back to ${mailbox}</button>
      `;
      document.querySelector('#back-button').addEventListener('click', () => load_mailbox(mailbox));
    });
}

function reply_to_email(email) {
  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  // Prefill composition fields
  document.querySelector('#compose-recipients').value = email.sender;
  
  // Check if subject already starts with Re:
  const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
  document.querySelector('#compose-subject').value = subject;
  
  // Prefill body with original email information
  document.querySelector('#compose-body').value = `\n\nOn ${email.timestamp} ${email.sender} wrote:\n${email.body}`;
}

function send_email(event) {
  // Prevent the default form submission behavior
  event.preventDefault();
  
  // Get form data
  const recipients = document.querySelector('#compose-recipients').value;
  const subject = document.querySelector('#compose-subject').value;
  const body = document.querySelector('#compose-body').value;
  
  // Show sending indicator
  document.querySelector('#compose-view').innerHTML += '<div id="sending-indicator">Sending email...</div>';
  
  // Send the email using fetch API
  fetch('/emails', {
    method: 'POST',
    body: JSON.stringify({
      recipients: recipients,
      subject: subject,
      body: body
    })
  })
  .then(response => response.json())
  .then(result => {
    // Print result
    console.log(result);
    
    // Remove sending indicator if present
    const indicator = document.getElementById('sending-indicator');
    if (indicator) indicator.remove();
    
    // Show success message or error
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      // Load the sent mailbox if email was sent successfully
      load_mailbox('sent');
    }
  })
  .catch(error => {
    console.log('Error:', error);
    // Remove sending indicator if present
    const indicator = document.getElementById('sending-indicator');
    if (indicator) indicator.remove();
    
    alert('Error sending email. Please try again.');
  });
}