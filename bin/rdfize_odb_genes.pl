#!/usr/bin/perl -w
use strict;
use File::Basename;
use Getopt::Std;
my $PROGRAM = basename $0;
my $USAGE=
"Usage: $PROGRAM
";

my %OPT;
getopts('v', \%OPT);

### Create RDF ###
my $ODB11 = "https://plant-oms.dbcls.jp/odb11";

print "\@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n";
print "\@prefix ncbigene: <http://identifiers.org/ncbigene/> .\n";
print "\@prefix up: <http://purl.uniprot.org/core/> .\n";
print "\@prefix upTax: <http://purl.uniprot.org/taxonomy/> .\n";
print "\n";

while (<>) {
    chomp;
    my @f = split(/\t/, $_, -1);
    if (@f != 8) {
        die "$PROGRAM: $_: expected 7 fields\n";
    }
    my $odb_gene_id = $f[0];
    my $ncbi_gene_id = $f[6];
    my $taxid;
    if ($odb_gene_id =~ /^(\d+)_\S+$/) {
        $taxid = $1;
    } else {
        die "$PROGRAM: $odb_gene_id: invalid format\n";
    }
    if ($ncbi_gene_id =~ /^(\d+)$/) {
        print "<$ODB11/$odb_gene_id>\n";
        print "    rdfs:seeAlso ncbigene:$ncbi_gene_id ;\n";
        print "    up:organism upTax:$taxid .\n";
        print "\n";
    } elsif ($OPT{v}) {
        print STDERR "$_: ncbi_gene_id not found\n";
    }
}        
