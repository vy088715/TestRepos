namespace GITP.API.DTOs;

// ── Query / Response DTOs ─────────────────────────────────────────────────────

public class LdapSettingsDto
{
    public Guid    Id              { get; set; }
    public Guid    CompanyId       { get; set; }
    public string  CompanyName     { get; set; } = "";
    public string  LdapHost        { get; set; } = "";
    public int     LdapPort        { get; set; } = 389;
    public bool    UseSsl          { get; set; }
    public string  BaseDn          { get; set; } = "";
    public string? DomainPrefix    { get; set; }
    public string? UpnSuffix       { get; set; }
    public string? BindDn          { get; set; }
    public string? BindPasswordMasked { get; set; }
    public string? UserSearchBase  { get; set; }
    public string  UserFilter      { get; set; } = "(sAMAccountName={0})";
    public bool    Enabled         { get; set; }
    public DateTime CreatedAt      { get; set; }
    public DateTime UpdatedAt      { get; set; }
}

// Internal model used only by LdapService (includes plain-text password)
public class LdapSettingsInternal
{
    public Guid    CompanyId       { get; set; }
    public string  LdapHost        { get; set; } = "";
    public int     LdapPort        { get; set; } = 389;
    public bool    UseSsl          { get; set; }
    public string  BaseDn          { get; set; } = "";
    public string? DomainPrefix    { get; set; }
    public string? UpnSuffix       { get; set; }
    public string? BindDn          { get; set; }
    public string? BindPassword    { get; set; }
    public string? UserSearchBase  { get; set; }
    public string  UserFilter      { get; set; } = "(sAMAccountName={0})";
    public bool    Enabled         { get; set; }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public class SaveLdapSettingsRequest
{
    public string  LdapHost        { get; set; } = "";
    public int     LdapPort        { get; set; } = 389;
    public bool    UseSsl          { get; set; }
    public string  BaseDn          { get; set; } = "";
    public string? DomainPrefix    { get; set; }
    public string? UpnSuffix       { get; set; }
    public string? BindDn          { get; set; }
    /// <summary>Null = keep existing password; empty string = clear password.</summary>
    public string? BindPassword    { get; set; }
    public string? UserSearchBase  { get; set; }
    public string  UserFilter      { get; set; } = "(sAMAccountName={0})";
    public bool    Enabled         { get; set; } = true;
}

public class LdapAuthRequest
{
    /// <summary>Username in any accepted format: DOMAIN\user, user@domain.local, or plain username.</summary>
    public string Username   { get; set; } = "";
    public string Password   { get; set; } = "";
    /// <summary>Optional: explicitly specify company_id to skip domain-based lookup.</summary>
    public Guid?  CompanyId  { get; set; }
}

public class LdapTestRequest
{
    public Guid   CompanyId { get; set; }
    public string Username  { get; set; } = "";
    public string Password  { get; set; } = "";
}
